import { parseUser } from "../utils/helpers.js";

export default {
    name: "m", // Packet name

    /**
     * Messages
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
     */
    async execute (bot, packet) {
        if (packet.s === "1" || packet.t[0] === "/") return;

        const userID = parseUser(packet.u);
        const message = packet.t.trim();

        if (!message) return;

        // xat server emituje SVAKU poruku nazad svim povezanim klijentima,
        // uključujući samog pošiljaoca. Bez ove provere, bot bi obrađivao
        // SVOJU SOPSTVENU poruku (npr. auto-poruku) kao da ju je napisao
        // neki korisnik - što je moglo da pokrene moderationFilters (npr.
        // linkDetect na sopstvenoj promo poruci sa linkom) i da bot sam
        // sebe kikuje/banuje čim pošalje poruku.
        if (userID === bot.state.loginInfo.i) return;

        if (message[0] === bot.state.settings.char) {
            return await bot.commandHandler.handle(
                message, 
                userID, 
                "main"
            );
        }

        if (bot.state.settings.modFilters)
            await bot.moderationFilters(userID, message);
    },
};
