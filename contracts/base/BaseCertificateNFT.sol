// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract BaseCertificateNFT is ERC721, Ownable {

    /**
     * @notice Dados base comuns a todos os produtos
     */
    struct BaseCertificate {
        string batchId;              // ID único do lote (ex: "LOTE-2025-001")
        string producerId;           // ID do produtor (Hash do CPF)
        string producerName;         // Nome do produtor
        string region;               // Região genérica (não GPS exato)
        uint256 quantity;            // Quantidade produzida
        string quantityUnit;         // Unidade (KG, L, etc)
        string documentsFolderCID;   // Carpeta IPFS con TODOS los documentos (laudo, fotos, certificados, etc)
        uint256 harvestDate;         // Data da colheita (timestamp)
        uint256 issuedDate;          // Data de emissão do certificado (timestamp)
        address issuer;              // Quem emitiu (entreposto)
        bool isActive;               // Certificado ativo ou revogad
    }

    //Mapeamento: tokenId => BaseCertificate
    mapping(uint256 => BaseCertificate) internal _certificates;

    uint256 private _nextTokenId;

    //Mapeamento: producerAddress => arrays de tokenIds
    mapping(address => uint256[]) private _producerTokens;

    // Mapeamento: batchId => tokenId (garante unicidade de lote)
    mapping(string => uint256) private _batchToToken;
    
    // Controle de quem pode emitir certificados (entrepostos autorizados)
    mapping(address => bool) public authorizedIssuers;

    // ════════════════════════════════════════════════════════════
    // EVENTS
    // ════════════════════════════════════════════════════════════
    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed producer,
        string batchId,
        string productType,
        uint256 timestamp
    );
    
    event CertificateRevoked(
        uint256 indexed tokenId,
        address revokedBy,
        string reason,
        uint256 timestamp
    );
    
    event IssuerAuthorized(
        address indexed issuer,
        address authorizedBy,
        uint256 timestamp
    );
    
    event IssuerRevoked(
        address indexed issuer,
        address revokedBy,
        uint256 timestamp
    );

    /**
     * @notice Apenas emissores autorizados podem chamar
     */
    modifier onlyAuthorizedIssuer() {
        require(
            authorizedIssuers[msg.sender] || msg.sender == owner(),
            "Not authorized issuer"
        );
        _;
    }
    
    /**
     * @notice Valida que lote não existe ainda
     */
    modifier uniqueBatch(string memory batchId) {
        require(
            _batchToToken[batchId] == 0,
            "Batch already has certificate"
        );
        _;
    }

    // ════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ════════════════════════════════════════════════════════════
    
    /**
     * @param _name Nome do token (ex: "HoneyCertificate")
     * @param _symbol Símbolo do token (ex: "HONEY")
     */
    constructor(
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        _nextTokenId = 1; //Começa do ID 1
    }

    /**
     * @notice Valida dados específicos do produto
     * @dev DEVE ser implementado por contratos que herdam
     * @param data Dados específicos encodados
     * @return true se válido
     */
    function _validateProductSpecificData(bytes memory data) 
        internal 
        virtual 
        returns (bool);

    /**
     * @notice Retorna tipo de produto
     * @dev DEVE ser implementado por contratos que herdam
     * @return Tipo do produto (ex: "HONEY", "MILK")
     */
    function _getProductType() 
        internal 
        virtual 
        pure 
        returns (string memory);


    /**
     * @notice Emite certificado
     * @dev Chamada por contratos específicos após validar dados próprios
     */
    function _issueCertificate(
        address producer,
        BaseCertificate memory baseCert,
        bytes memory productData
    ) internal onlyAuthorizedIssuer uniqueBatch(baseCert.batchId) returns (uint256) {
        
        require(
            _validateProductSpecificData(productData),
            "Invalid product-specific data"
        );
        
        require(producer != address(0), "Invalid producer address");
        require(bytes(baseCert.batchId).length > 0, "Batch ID required");
        require(baseCert.quantity > 0, "Quantity must be > 0");
        require(bytes(baseCert.documentsFolderCID).length > 0, "Documents CID required");
        
        // Gera novo token ID
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        
        baseCert.issuedDate = block.timestamp;
        baseCert.issuer = msg.sender;
        baseCert.isActive = true;
        
        // Mint NFT para o produtor
        _safeMint(producer, tokenId);
        
        // Armazena certificado
        _certificates[tokenId] = baseCert;
        
        // Mapeia batch → token
        _batchToToken[baseCert.batchId] = tokenId;
        
        // Adiciona token ao array do produtor
        _producerTokens[producer].push(tokenId);
        
        emit CertificateIssued(
            tokenId,
            producer,
            baseCert.batchId,
            _getProductType(),
            block.timestamp
        );
        
        return tokenId;
    }

    /**
     * @notice Autoriza um emissor (entreposto)
     */
    function authorizeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Invalid address");
        require(!authorizedIssuers[issuer], "Already authorized");
        
        authorizedIssuers[issuer] = true;
        
        emit IssuerAuthorized(issuer, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Revoga autorização de emissor
     */
    function revokeIssuer(address issuer) external onlyOwner {
        require(authorizedIssuers[issuer], "Not authorized");
        
        authorizedIssuers[issuer] = false;
        
        emit IssuerRevoked(issuer, msg.sender, block.timestamp);
    }

    /**
     * @notice Revoga um certificado (casos excepcionais)
     * @param tokenId ID do certificado
     * @param reason Motivo da revogação
     */
    function revokeCertificate(
        uint256 tokenId,
        string memory reason
    ) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Certificate does not exist");
        require(_certificates[tokenId].isActive, "Already revoked");
        
        _certificates[tokenId].isActive = false;
        
        emit CertificateRevoked(tokenId, msg.sender, reason, block.timestamp);
    } 

    // VIEW FUNCTIONS (públicas) 

    /**
     * @notice Retorna certificado base por tokenId
     */
    function getBaseCertificate(uint256 tokenId) 
        external 
        view 
        returns (BaseCertificate memory) 
    {
        return _certificates[tokenId];
    }
    
    /**
     * @notice Retorna todos os certificados de um produtor
     */
    function getProducerCertificates(address producer) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return _producerTokens[producer];
    }
    
    /**
     * @notice Retorna tokenId por batchId
     */
    function getTokenByBatch(string memory batchId) 
        external 
        view 
        returns (uint256) 
    {
        uint256 tokenId = _batchToToken[batchId];
        require(tokenId != 0, "Batch not found");
        return tokenId;
    }
    
    /**
     * @notice Verifica se certificado está ativo
     */
    function isCertificateActive(uint256 tokenId) 
        external 
        view 
        returns (bool) 
    {
        require(_ownerOf(tokenId) != address(0), "Certificate does not exist");
        return _certificates[tokenId].isActive;
    }
    
    /**
     * @notice Retorna total de certificados emitidos
     */
    function totalCertificates() external view returns (uint256) {
        return _nextTokenId - 1; // -1 porque começamos em 1
    } 

    // SOULBOUND (não-transferível)

    /**
     * @notice Sobrescreve transferência para tornar NFT soulbound
     * @dev Certificados não podem ser transferidos (exceto mint)
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Permite mint (from == address(0))
        // Bloqueia transferências (from != address(0))
        require(
            from == address(0),
            "Certificate NFTs are non-transferable (soulbound)"
        );
        
        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Sobrescreve approve (não permitido em soulbound)
     */
    function approve(address /* to */, uint256 /* tokenId */) 
        public 
        virtual 
        override 
    {
        revert("Certificate NFTs cannot be approved for transfer");
    }
    
    /**
     * @notice Sobrescreve setApprovalForAll (não permitido em soulbound)
     */
    function setApprovalForAll(address /* operator */, bool /* approved */) 
        public 
        virtual 
        override 
    {
        revert("Certificate NFTs cannot be approved for transfer");
    }







}