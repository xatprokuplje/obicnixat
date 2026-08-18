import axios from 'axios';

// SAMO modeli iz Gemini FREE tier-a (Flash porodica) - besplatni, bez
// kartice, samo sa rate-limit ograničenjem. Namerno NIJE dodat nijedan
// "Pro" model jer oni traže plaćeni (billing) nalog. Ako Google ugasi
// neki od ovih, zameni ID ovde.
const MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
];

export class Gemini {
    /**
     * Initializes Gemini client using API key from state.
     * @param {import('../services/state.js').BotState} state
     */
    constructor (state) {
        this.state = state;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/';
        this.apiKey = this.state.envData.geminiApiKey;
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 20000,
            headers: {
                'x-goog-api-key': this.apiKey,
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * @return {string[]} List of model IDs tried in order.
     */
    get models () {
        return MODELS;
    }

    /**
     * Asks a single Gemini model for a reply.
     * @param {string} model Model ID.
     * @param {string} prompt User's question/message.
     * @param {string} [systemPrompt] Optional system instruction.
     * @return {Promise<string>} The model's text reply.
     */
    async ask (model, prompt, systemPrompt) {
        if (!this.apiKey) throw new Error('GEMINI_API_KEY nije podešen.');

        const body = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
        };
        if (systemPrompt) {
            body.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        const response = await this.client.post(`${model}:generateContent`, body);

        const text = response.data?.candidates?.[0]?.content?.parts
            ?.map((p) => p.text || '').join('').trim();
        if (!text) throw new Error(`Prazan odgovor od modela ${model}.`);
        return text;
    }
}
