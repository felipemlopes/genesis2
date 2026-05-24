const { GoogleGenAI } = require("@google/genai");

const geminiClient = {
    async vision(imageBase64, prompt) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (!apiKey) {
            console.warn('API key missing. Returning default vision response.');
            return { elementos: [] };
        }
        try {
            const ai = new GoogleGenAI({ apiKey });
            const model = "gemini-3.1-pro-preview";
            const response = await ai.models.generateContent({
                model,
                contents: [
                    prompt,
                    {
                        inlineData: {
                            data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, ""),
                            mimeType: "image/jpeg"
                        }
                    }
                ],
                config: {
                    responseMimeType: "application/json"
                }
            });
            const text = response.text || "{}";
            return JSON.parse(text);
        } catch (err) {
            console.error("Vision API Error:", err);
            return { elementos: [] };
        }
    },
    
    async text(prompt) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (!apiKey) {
            console.warn('API key missing. Returning default text response.');
            return "Mercado sem setup claro. Capital preservado.";
        }
        try {
            const ai = new GoogleGenAI({ apiKey });
            const model = "gemini-3.1-pro-preview";
            const response = await ai.models.generateContent({
                model,
                contents: prompt
            });
            return response.text || "";
        } catch (err) {
            console.error("Text API Error:", err);
            return "Mercado sem setup claro. Capital preservado.";
        }
    }
};

module.exports = { geminiClient };
