const express = require("express");
const mongoose = require("mongoose");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const ContactUs = require("./models/contactUs");
const User = require("./models/Users");
const cors = require("cors");
const Subscriber = require("./models/Subscriber");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.status(200).json("Welcome to backend");
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || password !== user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { email: user.email, userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      data: {
        email: user._doc.email,
        token: token,
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

    // Check if the email already exists in the database
    const existingSubscriber = await Subscriber.findOne({ email });
    if (existingSubscriber) {
      return res.status(400).json({ error: "Email already subscribed" });
    }

    // If email doesn't exist, proceed with saving it
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
    const result = await Subscriber.findOneAndDelete({ email });

    if (!result) {
      return res.status(404).json({ error: "Email not found" });
    }

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
    const subscribers = await Subscriber.find({});
    res.status(200).json({ data: subscribers });
  } catch (error) {
    console.error("Error retrieving subscribers:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

app.get("/api/contacted", async (req, res) => {
  try {
    const contactUsMessages = await ContactUs.find({});
    res.status(200).json({ data: contactUsMessages });
  } catch (error) {
    console.error("Error retrieving contact us messages:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

app.get("/api/count", async (req, res) => {
  try {
    const totalContactUsCount = await ContactUs.countDocuments();
    const totalSubscribers = await Subscriber.countDocuments();
    res.status(200).json({ data: { totalContactUsCount, totalSubscribers } });
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
      process.env.GOOGLE_AUTH_REDIRECT_URL
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_AUTH_REFRESH_TOKEN,
    });

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

    await transporter.sendMail({
      from: `Growwitup Agency ${email}`,
      to: `${process.env.OWNER_EMAIL}`,
      subject: `${name} Want to Contact.`,
      html: `
                <h1>Name: ${name}</h1>
                <p>Email: ${email}</p>
                <p>Message: ${message}</p>
                <hr>                
            `,
    });

    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    let errorMessage = "Something went wrong. Please try again later.";

    // Check for specific error types and customize error message accordingly
    if (error.code === "EAUTH") {
      errorMessage =
        "Invalid authentication credentials. Please check your email configuration.";
    } else if (error.code === "ECONNECTION") {
      errorMessage =
        "Connection to email server failed. Please try again later.";
    } else if (error.responseCode === 550) {
      errorMessage = "Recipient email address is invalid.";
    }

    res.status(500).json({ error: errorMessage });
  }
});

app.post("/api/send-email", async (req, res) => {
  try {
    const { title, description } = req.body;
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({
        error: "Token is required for this action",
      });
    }
    const tokenPart = token.split(" ")[1];

    jwt.verify(tokenPart, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res
          .status(401)
          .json({ error: "Unauthorized to perform this action" });
      }

      const subscribers = await Subscriber.find();

      const OAuth2 = google.auth.OAuth2;
      const oauth2Client = new OAuth2(
        process.env.GOOGLE_AUTH_CLIENT_ID,
        process.env.GOOGLE_AUTH_CLIENT_SECRET,
        process.env.GOOGLE_AUTH_REDIRECT_URL
      );
      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_AUTH_REFRESH_TOKEN,
      });

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

      for (const subscriber of subscribers) {
        await transporter.sendMail({
          from: `Growwitup Agency ${process.env.OWNER_EMAIL}`,
          to: subscriber.email,
          subject: title,
          html: `<p>${description}</p><a href="${process.env.UNSUBSCRIBE_URL}/unsubscribe">Unsubscribe</a>`,
        });
      }

      res
        .status(200)
        .json({ message: "Email sent to all subscribers successfully!" });
    });
  } catch (error) {
    console.error("Error sending email to subscribers:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

app.post("/api/send-date", async (req, res) => {
  try {
    const { date, email } = req.body;
    console.log(date, email);

    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      process.env.GOOGLE_AUTH_CLIENT_ID,
      process.env.GOOGLE_AUTH_CLIENT_SECRET,
      process.env.GOOGLE_AUTH_REDIRECT_URL
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_AUTH_REFRESH_TOKEN,
    });

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

    await transporter.sendMail({
      from: `Growwitup Agency ${email}`,
      to: `${process.env.OWNER_EMAIL}`,
      subject: "Meeting Scheduled!",
      html: `<p>${date} is Selcted for meeting by ${email}.</p>`,
    });

    res.status(200).json({ message: "We will Contact you soon..." });
  } catch (error) {
    console.error("Error sending email to subscribers:", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

mongoose
  .connect(`${process.env.MONGO_URI}`)
  .then(() => {
    app.listen(process.env.PORT || 8080, () => {
      console.log(`Server running on port ${process.env.PORT || 8080}`);
    });
    console.log("Database is Connected.");
  })
  .catch((err) => {
    console.error("Error connecting to database:", err);
    console.log("Database not connected!");
  });
