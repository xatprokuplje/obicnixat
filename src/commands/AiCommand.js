export default {
    name: 'ai', // Command name

    /**
     * Executes the command. Usage: !ai <pitanje>
     * @param {Bot} bot - Bot instance
     * @param {string} xatID - User ID
     * @param {string} message - Message (pitanje za AI)
     * @param {string} from - Source (main, pc, pm)
    */
    async execute (bot, xatID, message, from) {
        if (!bot.state.aiEnabled) {
            return await bot.reply('AI je isključen za ovaj nalog.', xatID, from);
        }

        const prompt = (message || '').trim();
        if (!prompt) {
            return await bot.reply('Upotreba: !ai <pitanje>', xatID, from);
        }

        try {
            const { text, provider, model } = await bot.Ai.ask(prompt);
            bot.logger.info(`AiCommand: odgovorio ${provider}/${model}`);
            await bot.reply(text, xatID, from);
        } catch (error) {
            bot.logger.error(`AiCommand greška: ${error.message}`);
            await bot.reply('AI trenutno nije dostupan, pokušaj kasnije.', xatID, from);
        }
    }
}
