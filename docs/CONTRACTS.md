# Smart Contracts - Documentação

## BaseCertificateNFT.sol

### Descrição
Contrato base abstrato para todos os tipos de certificados de produtos. Implementa lógica comum de ERC-721 com características soulbound (não-transferível).

### Características Principais

#### 1. Soulbound NFT
- Certificados NÃO podem ser transferidos após mint
- Produtor mantém certificado permanentemente
- Serve como portfólio/reputação on-chain

#### 2. Sistema de Autorização
- Apenas entrepostos autorizados podem emitir certificados
- Owner pode autorizar/revogar emissores
- Multi-issuer support (vários entrepostos)

#### 3. Unicidade de Lotes
- Cada `batchId` pode ter apenas 1 certificado
- Previne duplicação
- Garante integridade

#### 4. Rastreabilidade
- Cada produtor tem array de todos seus certificados
- Busca por batchId → tokenId
- Histórico completo on-chain

### Structs

#### BaseCertificate
```solidity
struct BaseCertificate {
    string batchId;         // ID único do lote
    string producerId;      // ID do produtor
    string producerName;    // Nome do produtor
    string region;          // Região (não GPS exato)
    uint256 quantity;       // Quantidade produzida
    string quantityUnit;    // Unidade (KG, L)
    string documentsFolderCID;     // IPFS: evidências
    uint256 harvestDate;    // Timestamp colheita
    uint256 issuedDate;     // Timestamp emissão
    address issuer;         // Quem emitiu
    bool isActive;          // Ativo ou revogado
}
```

### Eventos

#### CertificateIssued
Emitido quando certificado é criado.
```solidity
event CertificateIssued(
    uint256 indexed tokenId,
    address indexed producer,
    string batchId,
    string productType,
    uint256 timestamp
);
```

#### CertificateRevoked
Emitido quando certificado é revogado (excepcional).
```solidity
event CertificateRevoked(
    uint256 indexed tokenId,
    address revokedBy,
    string reason,
    uint256 timestamp
);
```

### Funções Principais

#### authorizeIssuer
Autoriza um entreposto a emitir certificados.
```solidity
function authorizeIssuer(address issuer) external onlyOwner
```

#### getProducerCertificates
Retorna todos os certificados de um produtor.
```solidity
function getProducerCertificates(address producer) 
    external 
    view 
    returns (uint256[] memory)
```

#### getTokenByBatch
Busca certificado por ID do lote.
```solidity
function getTokenByBatch(string memory batchId) 
    external 
    view 
    returns (uint256)
```

### Produtos Específicos Devem Implementar

#### _validateProductSpecificData
Valida dados específicos do produto.
```solidity
function _validateProductSpecificData(bytes memory data) 
    internal 
    virtual 
    returns (bool);
```

#### _getProductType
Retorna tipo do produto.
```solidity
function _getProductType() 
    internal 
    virtual 
    pure 
    returns (string memory);
```

## HoneyCertificateNFT.sol

### Descripción
Contrato específico para certificados de miel. Herda de BaseCertificateNFT y adiciona validaciones y datos específicos del producto miel.

**Filosofía de Diseño:**
- **Smart Contract:** Almacena HECHOS verificables (datos brutos de análisis)
- **Laudo PDF (IPFS):** Contiene interpretación profesional (clasificación, conformidad)
- **Metadata JSON (IPFS):** Visualización amigable para wallets y marketplaces

### Niveles de Certificación Brasileña
```solidity
enum CertificationLevel {
    NONE,        // Sin certificación oficial
    MUNICIPAL,   // SIM - Servicio de Inspección Municipal (venta en municipio)
    ESTADUAL,    // SIE - Servicio de Inspección Estadual (venta en estado)  
    FEDERAL      // SIF - Servicio de Inspección Federal (venta nacional + exportación)
}
```

#### Resumen de Niveles

| Nivel | Código | Ámbito | Exportación |
|-------|--------|--------|-------------|
| Municipal | SIM | Municipio | ❌ No |
| Estadual | SIE | Estado | ❌ No |
| Federal | SIF | Nacional | ✅ Sí |

### Estructura de Datos

#### HoneySpecificData
```solidity
struct HoneySpecificData {
    string floralSource;         // "multifloral", "eucalyptus", etc
    string color;                // "amber", "light", "dark"
    uint16 moisture;             // 175 = 17.5%
    uint16 hmf;                  // 85 = 8.5 mg/kg
    ApiaryType apiaryType;       // FIXED o MIGRATORY
    CertificationLevel certificationLevel;
    string certificationNumber;  // "SIF-12345"
    string certifications;       // "organic,familyFarming,fair_trade"
}
```

**IMPORTANTE:** Este struct contiene solo **datos brutos** del análisis. La interpretación, clasificación de calidad (Tipo A/B/C) y conformidad se encuentran en el laudo laboratorial (PDF en IPFS).

### Documentos en IPFS

El campo `documentsFolderCID` (heredado de BaseCertificate) apunta a una carpeta IPFS con estructura organizada:
```
ipfs://QmDocuments.../
├─ manifest.json                    (índice de todos los documentos)
├─ OBLIGATORIOS/
│  ├─ laudo-laboratorial.pdf        (análisis completo con clasificación)
│  ├─ fotos/                        (evidencias del apiario y proceso)
│  └─ checklist-boas-praticas.json
└─ OPCIONALES/
   ├─ certificado-sif-12345.pdf     (si tiene certificación oficial)
   ├─ certificado-organico.pdf      (si tiene certificación orgánica)
   ├─ nota-fiscal.pdf
   └─ gta.pdf
```

### Función Principal
```solidity
function issueCertificate(
    address producerAddress,
    string memory batchId,
    string memory producerId,
    string memory producerName,
    string memory region,
    uint256 quantityKg,
    string memory documentsFolderCID,    // Carpeta IPFS con todos los docs
    uint256 harvestDate,
    HoneySpecificData memory honeySpecific,
    string memory metadataCID            // Metadata JSON para tokenURI
) external returns (uint256 tokenId)
```

### tokenURI (ERC-721 Metadata)

El contrato implementa `tokenURI()` que retorna IPFS URI con metadata JSON completo:
```solidity
function tokenURI(uint256 tokenId) public view returns (string memory)
// Retorna: "ipfs://QmMetadata..."
```

El metadata JSON incluye:
- Nombre y descripción del certificado
- Imagen visual del certificado
- Atributos (productor, región, calidad, certificación, etc)
- **Links a todos los documentos** (laudo, fotos, certificados)
- Blockchain proof

**Compatibilidad:**
- ✅ Wallets (MetaMask, Trust Wallet) - visualizan certificado
- ✅ Marketplaces NFT (OpenSea, Rarible) - listan automáticamente
- ✅ APIs externas - pueden integrar metadata

### Validaciones

El contrato realiza **solo validaciones básicas de formato**:
```solidity
✅ moisture > 0
✅ floralSource no vacío
✅ Si tiene certificación → debe tener número

❌ NO valida límites de calidad (moisture ≤ 20%, HMF < 60mg/kg)
   → Eso lo hace el laboratorio y está en el laudo PDF

❌ NO calcula grade de calidad (Tipo A/B/C)
   → Eso lo hace el laboratorio y está en el laudo PDF
```

**Razón:** Las reglas de negocio y regulaciones pueden cambiar. El smart contract es inmutable, por lo tanto almacena solo hechos verificables. La interpretación profesional está en el laudo certificado por laboratorio acreditado.

### Funcionalidades Especiales

#### Verificación de Exportación
```solidity
function canExport(uint256 tokenId) external view returns (bool)
```
Retorna `true` solo si tiene certificación FEDERAL (SIF). La verificación de calidad se realiza consultando el laudo laboratorial.

#### Estadísticas por Nivel
```solidity
function getCertificationStats() external view returns (
    uint256 none,
    uint256 municipal,
    uint256 estadual,
    uint256 federal
)
```

#### Gestión de IPFS Gateway
```solidity
function setIPFSGateway(string memory newGateway) external onlyOwner
function getIPFSGateway() external view returns (string memory)
```

Permite cambiar el gateway IPFS (de `ipfs://` a `https://ipfs.io/ipfs/` si es necesario).

### Ejemplo de Uso Completo
```solidity
// 1. Autorizar entreposto (owner)
honeyCert.authorizeIssuer(entrepostoAddress);

// 2. Preparar datos (backend)
// - Upload laudo PDF → IPFS
// - Upload fotos → IPFS  
// - Crear carpeta organizada → QmDocuments...
// - Generar metadata JSON → QmMetadata...

// 3. Emitir certificado (entreposto)
HoneySpecificData memory honeyData = HoneySpecificData({
    floralSource: "multifloral",
    color: "amber",
    moisture: 175,  // 17.5%
    hmf: 85,        // 8.5 mg/kg
    apiaryType: ApiaryType.FIXED,
    certificationLevel: CertificationLevel.FEDERAL,
    certificationNumber: "SIF-12345",
    certifications: "organic,familyFarming"
});

uint256 tokenId = honeyCert.issueCertificate(
    producerAddress,
    "LOTE-2025-001",
    "BR-MS-Produtor-001",
    "João da Silva",
    "Mato Grosso do Sul",
    150, // kg
    "QmDocuments...",  // Carpeta con laudo, fotos, etc
    block.timestamp,
    honeyData,
    "QmMetadata..."    // Metadata JSON
);

// 4. Verificar
string memory uri = honeyCert.tokenURI(tokenId);
// Retorna: "ipfs://QmMetadata..."

bool canExport = honeyCert.canExport(tokenId);
// Retorna: true (tiene SIF)
```

### Seguridad

- ✅ **Soulbound:** Certificados no-transferibles (previene reventa de certificados)
- ✅ **Ownable:** Solo owner puede autorizar/revocar emisores
- ✅ **Authorized Issuers:** Solo entrepostos autorizados pueden emitir
- ✅ **Batch Uniqueness:** Un certificado por lote (previene duplicados)
- ✅ **Immutable Data:** Datos on-chain son permanentes
- ✅ **IPFS Integrity:** CIDs garantizan integridad de documentos

### Testes

**33 testes automatizados** cubriendo:
- ✅ Deployment y configuración
- ✅ Sistema de autorización
- ✅ Emisión de certificados
- ✅ Validaciones de datos
- ✅ tokenURI y metadata
- ✅ Niveles de certificación
- ✅ Verificación de exportación
- ✅ Soulbound (no-transferible)
- ✅ Revocación de certificados

**Cobertura:** 100% de funciones públicas
