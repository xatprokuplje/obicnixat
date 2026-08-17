import { Sequelize } from "sequelize";
import path from "path";

// Ako je DATA_DIR podešen (mount path zakačenog diska na Render-u), baza
// se čuva tamo da bi preživela restart/deploy. Ako nije, čuva se pored
// koda (kao pre) - dovoljno za lokalni rad.
const dataDir = (process.env.DATA_DIR || "").trim();
const storagePath = dataDir ? path.join(dataDir, "database.db") : "./database.db";

export const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: storagePath,
    logging: false
});