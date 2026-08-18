import { parseUser } from "../utils/helpers.js";

export default {
    name: "p", // Packet name

    /**
     * PC / PM messages
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
     */
    async execute (bot, packet) {
        if (packet.t[0] === "/") return;

        if (packet.t[0] === bot.state.settings.char) {
            return await bot.commandHandler.handle(
                packet.t,
                parseUser(packet.u),
                packet.s == 2 ? "pc" : "pm"
            );
        }

        // Prirodno AI učešće i u PC/PM porukama, isto kao u main chatu.
        await bot.maybeReplyAsAi(parseUser(packet.u), packet.t, packet.s == 2 ? "pc" : "pm");
    },
};
