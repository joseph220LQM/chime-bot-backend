import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import WebSocket from "ws";
import fs from "fs";
import { ChimeSDKVoiceClient, CreateSipMediaApplicationCallCommand } from "@aws-sdk/client-chime-sdk-voice";

dotenv.config();
const app = express();
app.use(express.json());

app.post("/bot/join", async (req, res) => {
  try {
    const { meetingData } = req.body;
    if (!meetingData?.Meeting?.MeetingId) {
      return res.status(400).json({ error: "Falta meetingData.Meeting.MeetingId" });
    }

    console.log("🤖 Entrando a la reunión:", meetingData.Meeting.MeetingId);

    // 1️⃣ Crear attendee tipo Bot
    const attendeeRes = await fetch(
      "https://service.chime.aws.amazon.com/meetings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Amz-Target": "Chime.CreateAttendee",
          "X-Amz-Region": process.env.AWS_REGION,
        },
        body: JSON.stringify({
          MeetingId: meetingData.Meeting.MeetingId,
          ExternalUserId: `Bot-ElevenLabs-${Date.now()}`,
        }),
      }
    );
    const attendee = await attendeeRes.json();
    console.log("✅ Bot agregado:", attendee.Attendee?.AttendeeId);

    // 2️⃣ Conectarse al websocket de ElevenLabs Realtime
    const elevenWs = new WebSocket(
      `wss://api.elevenlabs.io/v1/convai/ws?model_id=${process.env.ELEVEN_MODEL_ID}`,
      {
        headers: { "xi-api-key": process.env.ELEVEN_API_KEY },
      }
    );

    elevenWs.on("open", () => {
      console.log("🎧 Conectado a ElevenLabs Realtime API");
      // Puedes enviar una frase inicial del bot:
      elevenWs.send(JSON.stringify({ text: "Hola a todos, soy el asistente virtual." }));
    });

    elevenWs.on("message", async (msg) => {
      const data = JSON.parse(msg);
      if (data.audio) {
        // 🔉 Guardar o reproducir la respuesta
        const buffer = Buffer.from(data.audio, "base64");
        fs.writeFileSync("bot-response.wav", buffer);
        console.log("🔊 Respuesta de voz recibida y guardada");
      }
      if (data.text) {
        console.log("🧠 Transcripción:", data.text);
      }
    });

    elevenWs.on("error", (err) => console.error("⚠️ Error en ElevenLabs WS:", err));

    // 3️⃣ Preparar transmisión de audio entrante desde la reunión (opcional: futura integración Chime Audio Stream)
    console.log("📡 Preparado para recibir audio de la reunión... (se implementa siguiente etapa)");

    res.json({
      message: "Bot conectado a reunión y ElevenLabs (modo voz)",
      attendee,
    });
  } catch (error) {
    console.error("❌ Error en /bot/join:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🤖 Bot backend con voz corriendo en puerto ${PORT}`));

