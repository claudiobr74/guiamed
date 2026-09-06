import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({ apiKey: key });
    }
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to support base64 images up to 25MB
  app.use(express.json({ limit: "25mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      geminiConfigured: !!process.env.GEMINI_API_KEY
    });
  });

  // AI Field Detection endpoint
  app.post("/api/detect-fields", async (req, res) => {
    try {
      const { image, pageNumber = 1, availableMappings = [] } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Imagem da página é obrigatória" });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: "Chave da API Gemini não configurada (GEMINI_API_KEY ausente)."
        });
      }

      // Extract base64 and mime type
      let mimeType = "image/png";
      let base64Data = image;
      const match = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }

      const mappingsList = availableMappings
        .map((m: any) => `- ${m.value}: ${m.label}`)
        .join("\n");

      const prompt = `Você é um especialista em visão computacional e OCR de guias de saúde e formulários médicos brasileiros (TUSS, Guias de SP/SADT, Internação, OPME de operadoras como Unimed, Bradesco, Amil, SulAmérica).

Analise visualmente com máxima precisão a imagem desta folha de formulário (Página ${pageNumber}).
Seu objetivo é identificar as caixas de preenchimento, linhas pontilhadas ou espaços retangulares onde os dados devem ser impressos.

Para cada campo encontrado:
1. Determine a chave "mappedTo" mais apropriada a partir desta lista oficial de campos do sistema:
${mappingsList}

2. Calcule com precisão as coordenadas PERCENTUAIS (0 a 100) em relação à página inteira:
- "x": posição horizontal do início da caixa (0% = borda esquerda, 100% = borda direita). Deve coincidir com onde o texto preenchido deve começar (logo após ou dentro da caixa do rótulo correspondente).
- "y": posição vertical do início da caixa (0% = topo da folha, 100% = base da folha).
- "width": largura percentual da caixa de preenchimento (ex: 35.5).
- "height": altura percentual da caixa de preenchimento (normalmente entre 2.2% e 3.5% para campos de 1 linha, ou 4% a 8% para campos de texto longo como indicação clínica / justificativa).
- "fontSize": tamanho da fonte recomendado (entre 8 e 12).
- "isCheckbox": true se for uma caixinha de seleção (checkbox), false caso contrário.
- "isMultiline": true se for campo de texto amplo (diagnóstico, justificativa, observações).
- "isList": true se for uma linha repetitiva de tabela de procedimentos ou OPME.
- "maxRows": se isList for true, informe a quantidade de linhas visíveis na grade da tabela (ex: 5).
- "rowSpacing": espaçamento vertical percentual aproximado entre as linhas (ex: 3.2).
- "confidence": número entre 0 e 1 indicando sua certeza.
- "name": rótulo legível em português.

Retorne EXCLUSIVAMENTE um objeto JSON no seguinte formato:
{
  "fields": [
    {
      "name": "Nome do Paciente",
      "mappedTo": "patient.name",
      "x": 12.0,
      "y": 14.2,
      "width": 50.0,
      "height": 2.6,
      "fontSize": 10,
      "isCheckbox": false,
      "isMultiline": false,
      "confidence": 0.95
    }
  ]
}
Não inclua explicações fora do JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          prompt
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch (pErr) {
        // Try extracting JSON block if wrapped in markdown
        const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        parsed = JSON.parse(cleaned);
      }

      const fields = Array.isArray(parsed) ? parsed : (parsed.fields || []);
      return res.json({ fields });
    } catch (err: any) {
      console.error("Erro na detecção de campos via Gemini:", err);
      return res.status(500).json({
        error: "Falha ao analisar imagem com IA: " + (err.message || "Erro desconhecido")
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
