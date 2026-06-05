import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";

// Diagnostics: log SMTP env values to help debugging
console.log("SMTP env:", {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER ? "<redacted>" : undefined,
    EMAIL_FROM: process.env.EMAIL_FROM,
});

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// verify transporter at startup to help debugging
transporter.verify()
    .then(() => console.log("SMTP transporter verified"))
    .catch((err) => console.error("SMTP transporter verification failed", err));

export const sendEmail = async ({ to, subject, text, html }) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info && info.messageId ? info.messageId : info);
        return info;
    } catch (err) {
        console.error("Failed to send email to", to, err);
        throw err;
    }
};

export default { sendEmail };
