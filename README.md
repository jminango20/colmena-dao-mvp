# 🍯 Colmena DAO - MVP

Sistema de rastreabilidade blockchain para produtores de mel usando NFT-Certificados e padrão EPCIS.

## 📋 Status do Projeto

**Fase Atual:** Semana 1 - Fundação & Smart Contracts

### ✅ Concluído
- [x] Setup do projeto
- [x] Configuração Hardhat
- [x] Deploy de teste na Mumbai testnet

### 🚧 Em Progresso
- [ ] BaseCertificateNFT.sol
- [ ] HoneyCertificateNFT.sol
- [ ] BatchTraceability.sol

## 🛠️ Tecnologias

- **Blockchain:** Polygon (Sepolia Testnet → Mainnet)
- **Smart Contracts:** Solidity 0.8.28
- **Framework:** Hardhat
- **Padrões:** ERC-721, EPCIS 2.0

## 📦 Contratos Deployed (Testnet)

| Contrato | Endereço | Network |
|----------|----------|---------|
| TestDeploy | `0xCB3098B1433C80B438C15FDaEa7f07a1C7369a83` | Sepolia |

## 🚀 Como Rodar

### Pré-requisitos
- Node.js 18+
- MetaMask com SEPOLIAETH na Sepolia testnet

### Instalação
```bash
npm install
```

### Compilar Contratos
```bash
npx hardhat compile
```

### Deploy Local
```bash
npx hardhat run scripts/deploy-test.ts
```

### Deploy Testnet
```bash
npx hardhat run scripts/deploy-test.ts --network mumbai
```

## 📚 Documentação

- [Arquitetura](./docs/ARCHITECTURE.md) (em breve)
- [API](./docs/API.md) (em breve)

## 👥 Equipe

Desenvolvido por Juan Minango

## 📄 Licença

MIT
```

### **Passo 14: Criar .gitignore Completo**

Edite `.gitignore`:
```
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Environment
.env
.env.local
.env.*.local

# Hardhat
cache/
artifacts/
typechain-types/

# Build
dist/
build/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Coverage
coverage/
coverage.json
.coverage_*