const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const ContactUs = require("./models/contactUs");
const User = require("./models/Users");
const cors = require("cors");
const Subscriber = require("./models/Subscriber");

require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(email, password);

  try {
    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if password is correct
    if (password !== user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // At this point, authentication is successful
    // You can generate a token or session and send it back to the client

    res.status(200).json({
      message: "Login successful",
      data: {
        ...user,
        token: process.env.TOKEN,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

app.post("/api/logout", async (req, res) => {
  res.status(200).json({ message: "Logout successful" });
});

app.post("/api/subscribe", async (req, res) => {
  try {
    const { email } = req.body;
    const subscriber = new Subscriber({ email });
    await subscriber.save();
    res.status(201).json({ message: "Subscribed successfully!" });
  } catch (error) {
    console.error("Error subscribing:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

app.post("/api/unsubscribe", async (req, res) => {
  const { email } = req.body;

  try {
    // Find the subscriber by email and remove them from the database
    await Subscriber.findOneAndDelete({ email });
    res.status(200).json({ message: "Unsubscribed successfully" });
  } catch (error) {
    console.error("Error unsubscribing:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

app.get("/api/subscribers", async (req, res) => {
  try {
    // Query the database to get all subscriber data
    const subscribers = await Subscriber.find({}); // Exclude _id field and only include email field

    // Return the subscriber data
    res.status(200).json(subscribers);
  } catch (error) {
    console.error("Error retrieving subscribers:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

app.get("/api/contacted", async (req, res) => {
  try {
    // Query the database to get all contact us data
    const contactUsMessages = await ContactUs.find({});

    // Return the contact us data
    res.status(200).json(contactUsMessages);
  } catch (error) {
    console.error("Error retrieving contact us messages:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

app.post("/api/send-email", async (req, res) => {
  try {
    const { title, description, token } = req.body;
    if (token !== process.env.TOKEN) {
      return res.status(200).json({
        message:
          "Email not sent to subscribers successfully! Token Not Found!(login again)",
      });
    }

    // Fetch all subscribers from the database
    const subscribers = await Subscriber.find();

    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      process.env.GOOGLE_AUTH_CLIENT_ID,
      process.env.GOOGLE_AUTH_CLIENT_SECRET,
      process.env.GOOGLE_AUTH_REDIRECT_URL // Redirect URL
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_AUTH_REFRESH_TOKEN,
    });

    // Create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        type: "OAuth2",
        user: process.env.OWNER_EMAIL,
        clientId: process.env.GOOGLE_AUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_AUTH_REFRESH_TOKEN,
        accessToken: oauth2Client.getAccessToken(),
      },
    });

    // Send email to each subscriber
    for (const subscriber of subscribers) {
      await transporter.sendMail({
        from: "Growwitup Agency <your_email@gmail.com>", // Sender address
        to: subscriber.email, // Subscriber's email
        subject: title, // Subject line
        html: `<p>${description}</p><a href="${process.env.URL}/unsubscribe">Unsubscribe</a>`, // Email body
      });
    }

    res
      .status(200)
      .json({ message: "Email sent to all subscribers successfully!" });
  } catch (error) {
    console.error("Error sending email to subscribers:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

app.get("/api/count", async (req, res) => {
  try {
    // Query the database to get the total count of contact us submissions
    const totalContactUsCount = await ContactUs.countDocuments();
    const totalSubscribers = await Subscriber.countDocuments();

    res.status(200).json({ totalContactUsCount, totalSubscribers });
  } catch (error) {
    console.error("Error getting total contact us count:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

app.post("/api/contact-us", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const contact = new ContactUs({ email, name, message });
    await contact.save();
    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      process.env.GOOGLE_AUTH_CLIENT_ID,
      process.env.GOOGLE_AUTH_CLIENT_SECRET,
      process.env.GOOGLE_AUTH_REDIRECT_URL // Redirect URL
    );

    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_AUTH_REFRESH_TOKEN,
    });

    // Create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        type: "OAuth2",
        user: process.env.OWNER_EMAIL,
        clientId: process.env.GOOGLE_AUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_AUTH_REFRESH_TOKEN,
        accessToken: oauth2Client.getAccessToken(),
      },
    });

    // Send mail with defined transport object
    await transporter.sendMail({
      from: `Growwitup Agency ${email}`, // Sender address
      // from: `"Growwitup Agency" ${email}`, // Sender address
      to: `${process.env.OWNER_EMAIL}`, // Client's email
      subject: `${name} Want to Contact.`, // Subject line
      html: `
                <h1>Name: ${name}</h1>
                <p>Email: ${email}</p>
                <p>Message: ${message}</p>
                <hr>                
            `, // HTML body
    });

    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;

mongoose
  .connect(`${process.env.MONGO_URI}`)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`, {
        useNewUrlParser: true,
      });
    });
    console.log("Database is Connected.");
  })
  .catch((err) => {
    console.log(err);
    console.log("Database not connected!");
  });
