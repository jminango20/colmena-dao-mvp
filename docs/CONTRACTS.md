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

---

## BatchTraceability.sol

### Descripción
Sistema de trazabilidad basado en EPCIS 2.0 (GS1 Standard).

**Arquitectura Híbrida:**
- **On-Chain (Blockchain):** Hash + metadata esencial
- **Off-Chain (PostgreSQL o IPFS):** EPCIS JSON-LD completo + índices para queries
- **Verificación:** Hash on-chain garantiza integridad de datos off-chain

**Características:**
- ✅ EPCIS 2.0 compliant (5 tipos de eventos estándar)
- ✅ Agnóstico de producto (mel, leche, café, granos, etc)
- ✅ Queries rápidas (PostgreSQL indexado, no blockchain)
- ✅ Interoperable con sistemas globales (SAP, Oracle, GS1 Registry)

### Tipos de Eventos EPCIS 2.0
```solidity
enum EPCISEventType {
    OBJECT,           // ObjectEvent - observar/mover objetos
    AGGREGATION,      // AggregationEvent - agrupar/separar
    TRANSACTION,      // TransactionEvent - transacciones comerciales
    TRANSFORMATION,   // TransformationEvent - transformación física
    ASSOCIATION       // AssociationEvent - asociar objetos (IoT)
}
```

#### Mapeo de Operaciones del Negocio → EPCIS

| Operación Negocio | Event Type | Action | bizStep |
|-------------------|------------|--------|---------|
| Producir/Cosechar | OBJECT | ADD | commissioning |
| Recibir | OBJECT | OBSERVE | receiving |
| Almacenar | OBJECT | OBSERVE | storing |
| Inspeccionar | OBJECT | OBSERVE | inspecting |
| Enviar | OBJECT | OBSERVE | shipping |
| Empaquetar | AGGREGATION | ADD | packing |
| Dividir lote | AGGREGATION | DELETE | unpacking |
| Transferir propiedad | TRANSACTION | ADD | shipping |
| Vender | TRANSACTION | ADD | retail_selling |
| Transformar (mel→crema) | TRANSFORMATION | - | commissioning |
| Asociar sensor IoT | ASSOCIATION | ADD | - |

**Ejemplos Agnósticos:**
- **Mel:** harvest → receive → inspect → pack → ship → sell
- **Leche:** milk → receive → pasteurize (TRANSFORMATION) → bottle (AGGREGATION) → ship → sell
- **Café:** harvest → receive → roast (TRANSFORMATION) → pack → ship → sell

### Acciones EPCIS
```solidity
enum EPCISAction {
    ADD,              // Agregar/crear/comisionar
    OBSERVE,          // Observar sin cambio de estado
    DELETE            // Remover/decomisionar
}
```

### Estructura de Datos
```solidity
struct Operation {
    uint256 operationId;           // ID único secuencial
    EPCISEventType eventType;      // Tipo evento EPCIS
    EPCISAction action;            // ADD, OBSERVE, DELETE
    string epc;                    // EPC principal (URN format)
    uint256 certificateTokenId;    // Referencia al certificado NFT
    address actor;                 // Quién ejecutó
    uint256 eventTime;            // Timestamp
    bytes32 epcisHash;            // SHA-256 del JSON-LD completo
}

```

**¿Qué NO está on-chain?**
- bizStep, disposition, bizLocation, readPoint
- sourceList, destinationList
- quantityList, uom
- businessTransactionList
- ilmd (Instance/Lot Master Data)
- Arrays de búsqueda, genealogía, índices

**Todos estos datos están off-chain, verificables con hash.**

### Ejemplo EPCIS 2.0 JSON-LD (Off-Chain)
```json
{
  "@context": [
    "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"
  ],
  "type": "EPCISDocument",
  "schemaVersion": "2.0",
  "creationDate": "2025-12-08T14:30:00.000Z",
  "epcisBody": {
    "eventList": [
      {
        "type": "ObjectEvent",
        "eventTime": "2025-11-25T14:30:00.000Z",
        "eventTimeZoneOffset": "-04:00",
        "recordTime": "2025-11-25T14:30:05.123Z",
        
        "epcList": [
          "urn:epc:id:sgtin:789.12345.LOTE-2025-001"
        ],
        
        "action": "OBSERVE",
        "bizStep": "urn:epcglobal:cbv:bizstep:receiving",
        "disposition": "urn:epcglobal:cbv:disp:in_progress",
        
        "bizLocation": {
          "id": "urn:epc:id:sgln:789.56789.0",
          "extension": {
            "name": "Entreposto MS",
            "coordinates": {
              "latitude": -20.456,
              "longitude": -54.789
            }
          }
        },
        
        "readPoint": {
          "id": "urn:epc:id:sgln:789.56789.DOCK-A"
        },
        
        "quantityList": [
          {
            "epcClass": "urn:epc:class:lgtin:789.12345.HONEY-MULTI",
            "quantity": 150,
            "uom": "KGM"
          }
        ],
        
        "sourceList": [
          {
            "type": "urn:epcglobal:cbv:sdt:possessing_party",
            "source": "urn:epc:id:pgln:789.JOAO-SILVA"
          },
          {
            "type": "urn:epcglobal:cbv:sdt:location",
            "source": "urn:epc:id:sgln:789.APIARIO-JOAO.0"
          }
        ],
        
        "destinationList": [
          {
            "type": "urn:epcglobal:cbv:sdt:possessing_party",
            "destination": "urn:epc:id:pgln:789.ENTREPOSTO-MS"
          }
        ],
        
        "extension": {
          "certificateNFT": {
            "blockchain": "Polygon",
            "contractAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
            "tokenId": 123,
            "transactionHash": "0xabc123..."
          },
          "qualityData": {
            "moisture": 17.5,
            "hmf": 8.5,
            "labReportCID": "QmLabReport456"
          },
          "privateData": {
            "encrypted": true,
            "algorithm": "AES-256-GCM",
            "data": {
              "commercialInvoice": "NF-12345",
              "price": {
                "amount": 6750.00,
                "currency": "BRL"
              },
              "paymentTerms": "30 days"
            }
          }
        }
      }
    ]
  }
}
```

**Hash SHA-256 de este JSON → guardado on-chain en `epcisHash`**

### Función Principal
```solidity
function recordOperation(
    EPCISEventType eventType,
    EPCISAction action,
    string memory epc,
    uint256 certificateTokenId,
    bytes32 epcisHash
) external onlyAuthorizedOperator returns (uint256)
```

**Flujo de Uso:**

1. **Backend genera EPCIS JSON-LD completo** (off-chain)
2. **Backend calcula hash SHA-256** del JSON
3. **Backend llama `recordOperation()`** con hash
4. **Blockchain guarda** operación + hash (immutable)
5. **Blockchain emite evento** `OperationRecorded`
6. **Backend escucha evento** y guarda JSON completo off-chain
7. **Usuarios consultan backend** (queries rápidas)
8. **Usuarios verifican integridad** con hash on-chain

### Control de Acceso
```solidity
// Autorizar operadores (entrepostos, transportadoras, etc)
function authorizeOperator(address operator) external onlyOwner

// Revocar operadores
function revokeOperator(address operator) external onlyOwner

// Autorizar múltiples en batch
function authorizeOperatorsBatch(address[] memory operators) external onlyOwner

// Verificar si es autorizado
function isAuthorizedOperator(address operator) external view returns (bool)
```

**Roles:**
- **Owner:** Autoriza/revoca operadores
- **Operadores Autorizados:** Pueden registrar operaciones (entrepostos, transportadoras, procesadores, retailers)
- **Owner también puede operar:** Útil para administración

### View Functions
```solidity
// Obtener operación por ID (para verificación individual)
function getOperation(uint256 operationId) external view returns (Operation memory)

// Total de operaciones registradas
function totalOperations() external view returns (uint256)

// Verificar integridad de datos off-chain
function verifyHash(uint256 operationId, bytes32 providedHash) external view returns (bool)

// Verificar si address es operador autorizado
function isAuthorizedOperator(address operator) external view returns (bool)
```
### Verificación de Integridad (Proof)

**Cualquier usuario puede verificar que datos off-chain no fueron alterados:**
```javascript
// 1. Usuario obtiene EPCIS JSON del backend
const response = await fetch('/api/operation/123');
const data = await response.json();

// 2. Usuario calcula hash del JSON
const jsonString = JSON.stringify(data.epcis_json);
const calculatedHash = ethers.keccak256(ethers.toUtf8Bytes(jsonString));

// 3. Usuario consulta blockchain
const onChainHash = await batchTraceContract.operations(123).epcisHash;

// 4. Usuario compara
if (calculatedHash === onChainHash) {
    console.log("✅ Datos verificados - no fueron alterados");
} else {
    console.log("❌ ALERTA: Datos fueron modificados!");
}

// También puede usar función helper del contrato:
const isValid = await batchTraceContract.verifyHash(123, calculatedHash);
```

### Eventos
```solidity
event OperationRecorded(
    uint256 indexed operationId,
    EPCISEventType indexed eventType,
    string epc,
    uint256 indexed certificateTokenId,
    address actor,
    bytes32 epcisHash,
    uint256 eventTime
);

event OperatorAuthorized(
    address indexed operator,
    address indexed authorizedBy,
    uint256 timestamp
);

event OperatorRevoked(
    address indexed operator,
    address indexed revokedBy,
    uint256 timestamp
);
```

**Backend Event Listener:**
```typescript
batchTraceContract.on("OperationRecorded", async (
    operationId,
    eventType,
    epc,
    certificateTokenId,
    actor,
    epcisHash,
    eventTime,
    event
) => {
    // 1. Generar EPCIS JSON-LD completo
    const epcisJSON = await generateEPCISJSON(operation);
    
    // 2. Verificar hash
    const calculatedHash = sha256(JSON.stringify(epcisJSON));
    if (calculatedHash !== epcisHash) {
        console.error("❌ Hash mismatch!");
        return;
    }
    
    // 3. Guardar en PostgreSQL con índices
    await db.operations.insert({
        operation_id: operationId,
        epcis_json: epcisJSON,
        epcis_hash: epcisHash,
        blockchain_tx: event.transactionHash,
        // ... campos indexados para búsquedas
    });
    
    // 4. Actualizar índices
    await updateSearchIndices(operationId, epc, certificateTokenId);
});
```

### Backend API Endpoints (Off-Chain Queries)
```typescript
// GET /api/batch/{epc}/history
// Retorna historial completo de un lote
// Tiempo: <100ms (PostgreSQL indexado)

// GET /api/certificate/{tokenId}/operations
// Retorna todas las operaciones de un certificado
// Tiempo: <50ms

// GET /api/operation/{operationId}/verify
// Verifica integridad comparando con blockchain
// Tiempo: <200ms (incluye lectura blockchain)

// GET /api/batch/{epc}/genealogy
// Retorna árbol completo (padres, hijos, nietos)
// Tiempo: <100ms (recursive query PostgreSQL)
```

### Ejemplo de Uso Completo
```javascript
// ════════════════════════════════════════════════════════════
// SETUP: Autorizar operadores
// ════════════════════════════════════════════════════════════

await batchTrace.authorizeOperator(entrepostoAddress);
await batchTrace.authorizeOperator(transportadoraAddress);
await batchTrace.authorizeOperator(importadorAddress);

// ════════════════════════════════════════════════════════════
// DÍA 1: João cosecha mel (CREATE)
// ════════════════════════════════════════════════════════════

// Backend genera EPCIS JSON-LD
const epcisJSON = {
    type: "ObjectEvent",
    action: "ADD",
    bizStep: "urn:epcglobal:cbv:bizstep:commissioning",
    epcList: ["urn:epc:id:sgtin:789.12345.LOTE-2025-001"],
    // ... datos completos
};

// Backend calcula hash
const hash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(epcisJSON)));

// Backend llama contrato
await batchTrace.connect(entreposto).recordOperation(
    0, // OBJECT
    0, // ADD
    "urn:epc:id:sgtin:789.12345.LOTE-2025-001",
    123, // certificate NFT
    hash
);

// ════════════════════════════════════════════════════════════
// DÍA 2: Transfer a entreposto (OBSERVE)
// ════════════════════════════════════════════════════════════

const epcisJSON2 = {
    type: "ObjectEvent",
    action: "OBSERVE",
    bizStep: "urn:epcglobal:cbv:bizstep:receiving",
    // ...
};

const hash2 = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(epcisJSON2)));

await batchTrace.connect(entreposto).recordOperation(
    0, // OBJECT
    1, // OBSERVE
    "urn:epc:id:sgtin:789.12345.LOTE-2025-001",
    123,
    hash2
);

// ════════════════════════════════════════════════════════════
// DÍA 5: Split de lote (AGGREGATION)
// ════════════════════════════════════════════════════════════

const epcisJSON3 = {
    type: "AggregationEvent",
    action: "DELETE", // unpacking/splitting
    parentID: "urn:epc:id:sgtin:789.12345.LOTE-2025-001",
    childEPCs: [
        "urn:epc:id:sgtin:789.12345.LOTE-2025-001-A",
        "urn:epc:id:sgtin:789.12345.LOTE-2025-001-B",
        "urn:epc:id:sgtin:789.12345.LOTE-2025-001-C"
    ],
    // ...
};

const hash3 = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(epcisJSON3)));

await batchTrace.connect(entreposto).recordOperation(
    1, // AGGREGATION
    2, // DELETE
    "urn:epc:id:sgtin:789.12345.LOTE-2025-001",
    123,
    hash3
);

// Backend procesa evento y actualiza genealogía en DB

// ════════════════════════════════════════════════════════════
// CONSULTAS (Backend API)
// ════════════════════════════════════════════════════════════

// Ver historial completo
const history = await fetch('/api/batch/LOTE-2025-001/history');

// Ver genealogía
const tree = await fetch('/api/batch/LOTE-2025-001/genealogy');
// Retorna: padre, hijos, nietos, etc (recursive query)

// Verificar integridad
const proof = await fetch('/api/operation/3/verify');
// Calcula hash, compara con blockchain
```

### Interoperabilidad EPCIS 2.0

El sistema es completamente interoperable con:

**Sistemas ERP/SCM:**
- ✅ SAP (EPCIS adapter)
- ✅ Oracle Supply Chain Management
- ✅ IBM Food Trust
- ✅ Microsoft Dynamics 365

**Plataformas:**
- ✅ GS1 Cloud
- ✅ EU EUDR Registry (compliance reporting)
- ✅ Carbon Credit Platforms
- ✅ Sustainability Tracking Systems

**Formato Export:**
```javascript
// Backend puede exportar EPCIS JSON-LD estándar
GET /api/epcis/export?batchId=LOTE-2025-001&format=jsonld

// Sistema externo puede importar directamente
// Hash en blockchain sirve como proof de integridad
```

### Testes

**34 testes automatizados** cubriendo:
- ✅ Deployment y configuración
- ✅ Control de acceso (authorize/revoke)
- ✅ Registro de operaciones
- ✅ Todos los tipos de eventos EPCIS
- ✅ Todas las acciones EPCIS
- ✅ Verificación de hash
- ✅ View functions
- ✅ Múltiples operadores
- ✅ Validaciones y errores

**Cobertura:** 100% de funciones públicas