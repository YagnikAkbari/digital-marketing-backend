const express = require("express");
const mongoose = require("mongoose");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const ContactUs = require("./models/contactUs");
const User = require("./models/Users");
const cors = require("cors");
const Subscriber = require("./models/Subscriber");

require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (password !== user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

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
    const subscribers = await Subscriber.find({});

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
    const contactUsMessages = await ContactUs.find({});

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
        html: `<p>${description}</p><a href="${process.env.URL}/unsubscribe">Unsubscribe</a>`,
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
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
});

const PORT = process.env.PORT || 8080;

mongoose
  .connect(`${process.env.MONGO_URI}`)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    console.log("Database is Connected.");
  })
  .catch((err) => {
    console.error("Error connecting to database:", err);
    console.log("Database not connected!");
  });
