import { DataTypes } from "sequelize";
import { sequelize } from "../core/Database.js";

export const Settings = sequelize.define("settings", {
    maxKicks: {
        type: DataTypes.INTEGER,
        defaultValue: 3
    },
    banDurationHours: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    capsLockMax: {
        type: DataTypes.INTEGER,
        defaultValue: 6
    },
    linesMax: {
        type: DataTypes.INTEGER,
        defaultValue: 4
    },
    maxLetters: {
        type: DataTypes.INTEGER,
        defaultValue: 8
    },
    maxSmilies: {
        type: DataTypes.INTEGER,
        defaultValue: 4
    },
    modFilters: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    capsLockDetect: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    floodDetect: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    inappDetect: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    spamDetect: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    spamSmiliesDetect: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    linkDetect: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    openAiDetect: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    linkWhitelist: {
        type: DataTypes.STRING,
        defaultValue: "xat.wiki,xatblog.net,xatimg.com,xat.com,google.com,facebook.com,instagram.com,twitter.com,discord.gg,youtube.com,radiogalaksija.onrender.com"
    },
    // Jedinstvena "chat skripta" - JEDNA tabela poruka (ne po nalogu).
    // Niz redova { username, text, delaySeconds }, u tačno tom redosledu
    // kojim se emituju na chat. delaySeconds = koliko sekundi da se čeka
    // NAKON prethodnog reda u nizu (prvi red može imati 0 = odmah).
    // Kad se stigne do kraja niza, kreće se ispočetka (petlja).
    chatScript: {
        type: DataTypes.TEXT,
        defaultValue: "[]",
        get () {
            try {
                const raw = this.getDataValue("chatScript");
                const parsed = JSON.parse(raw || "[]");
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        },
        set (value) {
            this.setDataValue("chatScript", JSON.stringify(Array.isArray(value) ? value : []));
        }
    },
    char: {
        type: DataTypes.STRING,
        defaultValue: "!"
    },
    welcome_msg: {
        type: DataTypes.STRING,
        defaultValue: "Dobro došli u Radio Prokuplje, sa vama su dj-i Dia, Nezna, Puma, Tigrica i X, mi smo na ovoj adresi https://radiogalaksija.onrender.com/ (naša stranica), možete nas posetiti sa svih uređaja, samo kopirajte adresu i nalepite je u adresnu traku bilo kog browsera!"
    },
    welcome_type: {
        type: DataTypes.STRING,
        defaultValue: "pm"
    },
    nick: {
        type: DataTypes.STRING,
        defaultValue: "Bot"
    },
    stealth: {
        type: DataTypes.STRING,
        defaultValue: "disable"
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "xat.com"
    },
    avatar: {
        type: DataTypes.STRING,
        defaultValue: "171"
    },
    pcback: {
        type: DataTypes.STRING,
        defaultValue: "https://i.thuk.space/pcback.jpg"
    },
    home: {
        type: DataTypes.STRING,
        defaultValue: "xat.com"
    },
    pstyle_image: {
        type: DataTypes.STRING,
        defaultValue: "https://i.thuk.space/tucco.gif"
    },
    pstyle_color: {
        type: DataTypes.STRING,
        defaultValue: "#000000"
    },
    pstyle_icons: {
        type: DataTypes.STRING,
        defaultValue: "true"
    },
    pstyle_grad: {
        type: DataTypes.STRING,
        defaultValue: "pg1"
    },
    statusfx_effect: {
        type: DataTypes.STRING,
        defaultValue: "1"
    },
    statusfx_speed: {
        type: DataTypes.STRING,
        defaultValue: "3"
    },
    statusfx_status2: {
        type: DataTypes.STRING,
        defaultValue: ""
    },
    statusfx_wave_frequency: {
        type: DataTypes.STRING,
        defaultValue: "5"
    },
    avatareffect: {
        type: DataTypes.STRING,
        defaultValue: ""
    },
    avatarframe: {
        type: DataTypes.STRING,
        defaultValue: "none"
    },
    avatarspeed: {
        type: DataTypes.STRING,
        defaultValue: "13"
    },
    avatarcolor: {
        type: DataTypes.STRING,
        defaultValue: "#FFFFFF"
    },
    pcplus: {
        type: DataTypes.STRING,
        defaultValue: "off"
    },
}, {
    timestamps: false
});