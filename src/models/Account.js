import { DataTypes } from "sequelize";
import { sequelize } from "../core/Database.js";

// Podrazumevani razmak (u sekundama) za poruku koja ga nema eksplicitno
// zadatog (npr. stari format ili neispravan unos).
const DEFAULT_DELAY_SECONDS = 60;

/**
 * Normalizes a single auto-message entry to the { text, delaySeconds }
 * shape, accepting both the current object format and the legacy plain
 * string format (used before per-message timing existed).
 * @param {string|{text?: string, delaySeconds?: number}} m
 * @returns {{ text: string, delaySeconds: number }}
 */
function normalizeMessage (m) {
    if (m && typeof m === 'object') {
        const seconds = Number(m.delaySeconds);
        return {
            text: String(m.text || '').trim(),
            delaySeconds: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : DEFAULT_DELAY_SECONDS,
        };
    }
    return { text: String(m ?? '').trim(), delaySeconds: DEFAULT_DELAY_SECONDS };
}

export const Account = sequelize.define("account", {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    apikey: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Nadimak kojim se nalog prikazuje u chatu. Podrazumevano = username,
    // ali može dinamički da se menja preko admin panela.
    nickname: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Lista poruka koje nalog automatski šalje u chat, redom, u krug.
    // Čuva se kao JSON niz objekata: [{ text, delaySeconds }, ...].
    // `delaySeconds` je vreme (u sekundama) koje se čeka NAKON prethodne
    // poslate poruke ovog naloga, pre nego što se pošalje baš ova poruka.
    // Radi kompatibilnosti unazad, stari format (niz golih stringova) se
    // pri čitanju automatski pretvara u ovaj oblik sa podrazumevanih 60s.
    messages: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '[]',
        get () {
            const raw = this.getDataValue('messages');
            let parsed;
            try {
                parsed = JSON.parse(raw || '[]');
            } catch {
                parsed = [];
            }
            if (!Array.isArray(parsed)) return [];

            return parsed
                .map((m) => normalizeMessage(m))
                .filter((m) => m.text.length > 0);
        },
        set (value) {
            const arr = Array.isArray(value) ? value : [];
            const normalized = arr.map((m) => normalizeMessage(m)).filter((m) => m.text.length > 0);
            this.setDataValue('messages', JSON.stringify(normalized));
        }
    },
    // Razmak između automatskih poruka, u milisekundama. Zadržano radi
    // kompatibilnosti sa starim redovima u bazi - više se ne koristi jer
    // svaka poruka sada nosi svoj sopstveni razmak (messages[].delaySeconds).
    messageIntervalMs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60000
    },
    // Da li ovaj nalog sme da odgovara na !ai komandu (kvadratić u admin
    // panelu, pored naloga). Podrazumevano ISKLJUČENO - admin ga svesno
    // uključuje po nalogu preko panela.
    aiEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    timestamps: true
});
