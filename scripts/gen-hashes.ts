import { hashSync } from "bcryptjs"

console.log("admin123:", hashSync("admin123", 10))
console.log("tecnico123:", hashSync("tecnico123", 10))
console.log("agri123:", hashSync("agri123", 10))
