const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // 1️⃣ Deploy del contrato
  const IdentityManager = await hre.ethers.getContractFactory("IdentityManager");
  const identityManager = await IdentityManager.deploy();
  await identityManager.waitForDeployment();
  const contractAddress = await identityManager.getAddress();

  console.log(`✅ IdentityManager desplegado en la dirección: ${contractAddress}`);

  // 2️⃣ Directorio de salida para Angular
  const assetsDir = path.join(__dirname, "..", "src", "assets"); 
  const outputPath = path.join(assetsDir, "IdentityManager.json");

  // 3️⃣ Crear el directorio si no existe
  if (!fs.existsSync(assetsDir)) {
    console.log(`📂 Carpeta de assets no encontrada, creando: ${assetsDir}`);
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // 4️⃣ Construir el objeto JSON con dirección y ABI
  const contractData = {
    address: contractAddress,
    abi: IdentityManager.interface.format("json") // <-- 🔑 Genera el ABI como JSON válido
  };

  // 5️⃣ Guardar en el archivo JSON
  fs.writeFileSync(outputPath, JSON.stringify(contractData, null, 2));
  console.log(`✅ Dirección y ABI guardados en: ${outputPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
