import axios from 'axios';

// Redosled modela kojim se pokušava odgovor - ako prvi "pukne" (limit,
// greška, timeout), automatski se prelazi na sledeći. Ovo su trenutno
// aktivni "production" modeli na Groq-u (avgust 2026). Ako Groq u
// međuvremenu ugasi neki od njih, samo zameni ID ovde - ništa drugo u
// projektu ne treba da se menja.
const MODELS = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b',
];

export class Groq {
    /**
     * Initializes Groq client using API key from state.
     * @param {import('../services/state.js').BotState} state
     */
    constructor (state) {
        this.state = state;
        this.baseUrl = 'https://api.groq.com/openai/v1/';
        this.apiKey = this.state.envData.groqApiKey;
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 20000,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
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
     * Asks a single Groq model for a chat completion.
     * @param {string} model Model ID.
     * @param {string} prompt User's question/message.
     * @param {string} [systemPrompt] Optional system instruction.
     * @return {Promise<string>} The model's text reply.
     */
    async ask (model, prompt, systemPrompt) {
        if (!this.apiKey) throw new Error('GROQ_API_KEY nije podešen.');

        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const response = await this.client.post('chat/completions', {
            model,
            messages,
            temperature: 0.7,
            max_tokens: 600,
        });

        const text = response.data?.choices?.[0]?.message?.content;
        if (!text || !text.trim()) throw new Error(`Prazan odgovor od modela ${model}.`);
        return text.trim();
    }
}
