import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import WebSocket from "ws";
import fs from "fs";

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
    const attendeeRes = await fetch("https://service.chime.aws.amazon.com/meetings", {
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
    });

    const attendee = await attendeeRes.json();
    console.log("✅ Bot agregado:", attendee.Attendee?.AttendeeId);

    // 2️⃣ Conexión correcta a ElevenLabs Realtime (modelo + voz)
    const elevenWs = new WebSocket(
      `wss://api.elevenlabs.io/v1/convai/ws?model_id=${process.env.ELEVENLABS_MODEL}&voice_id=${process.env.ELEVENLABS_VOICE_ID}`,
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Accept": "application/json",
        },
      }
    );

    elevenWs.on("open", () => {
      console.log("🎧 Conectado a ElevenLabs Realtime API");
      elevenWs.send(JSON.stringify({ text: "Hola a todos, soy el asistente virtual." }));
    });

    elevenWs.on("message", async (msg) => {
      const data = JSON.parse(msg);
      if (data.audio) {
        const buffer = Buffer.from(data.audio, "base64");
        fs.writeFileSync("bot-response.wav", buffer);
        console.log("🔊 Respuesta de voz recibida y guardada");
      }
      if (data.text) {
        console.log("🧠 Transcripción:", data.text);
      }
    });

    elevenWs.on("error", (err) => console.error("⚠️ Error en ElevenLabs WS:", err));

    console.log("📡 Preparado para recibir audio de la reunión... (siguiente etapa)");

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
app.listen(PORT, () => {
  console.log(`🤖 Bot backend con voz corriendo en puerto ${PORT}`);

  // 🔍 Verificar API key al iniciar
  fetch("https://api.elevenlabs.io/v1/user", {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
  })
    .then((r) => r.json())
    .then((data) => {
      if (data && data.subscription) {
        console.log("✅ API Key ElevenLabs válida:", data.subscription.tier);
      } else {
        console.log("⚠️ API Key ElevenLabs inválida o sin permisos.");
      }
    })
    .catch((err) => console.error("⚠️ Error verificando API Key:", err.message));
});