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
    string evidenceCID;     // IPFS: evidências
    string labReportCID;    // IPFS: laudo lab
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

### Gas Costs Estimados

| Operação | Gas Estimado |
|----------|--------------|
| Deploy | ~2,500,000 |
| Mint Certificate | ~200,000 |
| Authorize Issuer | ~50,000 |
| Get Certificate | 0 (view) |

### Segurança

✅ Soulbound implementado (não-transferível)
✅ Autorização de emissores
✅ Unicidade de lotes
✅ Revogação de emergência (owner)
✅ OpenZeppelin base (auditado)

### Próximos Passos

- [ ] Implementar HoneyCertificateNFT.sol
- [ ] Testes completos
- [ ] Deploy testnet
- [ ] Auditoria de segurança (produção)