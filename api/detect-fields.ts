import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { image, pageNumber = 1, availableMappings = [] } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Imagem da página é obrigatória' });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(503).json({ error: 'GEMINI_API_KEY não configurada.' });
    }

    let mimeType = 'image/png';
    let base64Data = image;
    const match = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }

    const mappingsList = availableMappings
      .map((m: any) => `- ${m.value}: ${m.label}`)
      .join('\n');

    const prompt = `Analise esta página de uma guia médica brasileira (página ${pageNumber}) e identifique apenas os campos reais de preenchimento.
Associe cada campo, quando possível, a uma das chaves abaixo:
${mappingsList}

Retorne exclusivamente JSON no formato:
{"fields":[{"name":"Nome do campo","mappedTo":"patient.name","x":0,"y":0,"width":0,"height":0,"fontSize":10,"isCheckbox":false,"isMultiline":false,"isList":false,"maxRows":1,"rowSpacing":0,"confidence":0.9}]}

As coordenadas x, y, width e height devem ser percentuais de 0 a 100 em relação à página inteira. Não invente campos que não estejam visíveis.`;

    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ inlineData: { data: base64Data, mimeType } }, prompt],
      config: { responseMimeType: 'application/json' }
    });

    const responseText = response.text || '{}';
    const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const fields = Array.isArray(parsed) ? parsed : (parsed.fields || []);
    return res.status(200).json({ fields });
  } catch (error: any) {
    console.error('Erro na detecção de campos:', error);
    return res.status(500).json({ error: error?.message || 'Falha ao analisar imagem com IA.' });
  }
}
