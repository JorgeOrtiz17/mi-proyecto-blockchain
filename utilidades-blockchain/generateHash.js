const crypto = require('crypto');

// Cambia este texto por el nombre o ID que quieras hashear
const texto = "Juan riqeutt";

// Genera el hash SHA256 en formato hexadecimal
const hash = crypto.createHash('sha256').update(texto).digest('hex');

console.log(`Hash generado para "${texto}":\n${hash}`);
