// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../base/BaseCertificateNFT.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title HoneyCertificateNFT
 * @notice Certificados NFT específicos para productores de miel
 * @dev Hereda de BaseCertificateNFT y adiciona datos específicos de miel
 * 
 * Incluye:
 * - Datos de calidad brutos (humedad, HMF, fuente floral)
 * - Niveles de certificación brasileña (SIM/SIE/SIF)
 * - tokenURI con metadata IPFS
 * - Validaciones mínimas (solo formato, NO business rules)
 */
contract HoneyCertificateNFT is BaseCertificateNFT {
        
    /**
     * @notice Niveles de certificación sanitaria en Brasil
     * @dev Sistema brasileño de inspección de productos de origen animal
     */
    enum CertificationLevel {
        NONE,        // Sin certificación oficial (solo trazabilidad)
        MUNICIPAL,   // SIM - Servicio de Inspección Municipal (venta en municipio)
        ESTADUAL,    // SIE - Servicio de Inspección Estadual (venta en estado)
        FEDERAL      // SIF - Servicio de Inspección Federal (venta nacional + exportación)
    }
    
    /**
     * @notice Tipo de apiario
     */
    enum ApiaryType {
        FIXED,       // Apiario fijo
        MIGRATORY    // Apicultura migratoria (polinización)
    }
    
    // ════════════════════════════════════════════════════════════
    // STRUCTS
    // ════════════════════════════════════════════════════════════
    
    /**
     * @notice Datos específicos de miel
     * @dev Solo datos BRUTOS - interpretación está en laudo PDF (IPFS)
     */
    struct HoneySpecificData {
        // Datos de análisis (valores brutos del laboratorio)
        string floralSource;        // "multifloral", "eucalyptus", "orange blossom"
        string color;               // "amber", "light", "dark"
        uint16 moisture;            // Humedad en décimos (175 = 17.5%)
        uint16 hmf;                 // HMF en mg/kg (85 = 8.5 mg/kg)
        
        // Metadata del apiario
        ApiaryType apiaryType;      // Tipo de apiario
        
        // Certificación oficial brasileña
        CertificationLevel certificationLevel;  // Nivel de certificación
        string certificationNumber;             // "SIF-12345", "SIE-MS-67890"
        
        // Otras certificaciones (comma-separated)
        string certifications;      // "organic,familyFarming,fair_trade"
    }
    
    
    // Mapeo: tokenId => HoneySpecificData
    mapping(uint256 => HoneySpecificData) public honeyData;
    
    // Mapeo: tokenId => metadata CID (IPFS)
    mapping(uint256 => string) private _tokenMetadataCID;
    
    // Gateway IPFS (puede ser actualizado)
    string private _ipfsGateway = "ipfs://";
    
    // Contador de certificados por nivel (estadísticas)
    mapping(CertificationLevel => uint256) public certificatesByLevel;
    
    // ════════════════════════════════════════════════════════════
    // EVENTS
    // ════════════════════════════════════════════════════════════
    
    event HoneyCertificateIssued(
        uint256 indexed tokenId,
        address indexed producer,
        string batchId,
        CertificationLevel certificationLevel,
        string metadataCID,
        uint256 timestamp
    );
    
    event MetadataURIUpdated(
        uint256 indexed tokenId,
        string newMetadataCID,
        uint256 timestamp
    );
    
    event IPFSGatewayUpdated(
        string oldGateway,
        string newGateway,
        uint256 timestamp
    );
    
    constructor() BaseCertificateNFT("HoneyCertificate", "HONEY") {}
        
    /**
     * @notice Emite certificado para productor de miel
     * @dev Valida datos y llama _issueCertificate del contrato base
     * 
     * @param producerAddress Dirección de la wallet del productor
     * @param batchId ID único del lote (ej: "LOTE-2025-001")
     * @param producerId ID del produtor (puede ser hash del CPF)
     * @param producerName Nombre del productor
     * @param region Región genérica (ej: "Mato Grosso do Sul")
     * @param quantityKg Cantidad en kilogramos
     * @param documentsFolderCID IPFS CID de carpeta con TODOS los documentos
     * @param harvestDate Timestamp de la fecha de cosecha
     * @param honeySpecific Datos específicos de miel
     * @param metadataCID IPFS CID del JSON de metadata completo (para tokenURI)
     * @return tokenId ID del NFT emitido
     */
    function issueCertificate(
        address producerAddress,
        // Datos base
        string memory batchId,
        string memory producerId,
        string memory producerName,
        string memory region,
        uint256 quantityKg,
        string memory documentsFolderCID,
        uint256 harvestDate,
        // Datos específicos de miel
        HoneySpecificData memory honeySpecific,
        // Metadata URI
        string memory metadataCID
    ) external onlyAuthorizedIssuer returns (uint256) {
        
        require(bytes(metadataCID).length > 0, "Metadata CID required");
        
        BaseCertificate memory baseCert = BaseCertificate({
            batchId: batchId,
            producerId: producerId,
            producerName: producerName,
            region: region,
            quantity: quantityKg,
            quantityUnit: "KG",
            documentsFolderCID: documentsFolderCID,
            harvestDate: harvestDate,
            issuedDate: 0,  
            issuer: address(0),  
            isActive: true
        });
        
        // Encode datos específicos de miel
        bytes memory productData = abi.encode(honeySpecific);
        
        uint256 tokenId = _issueCertificate(
            producerAddress,
            baseCert,
            productData
        );
        
        // Almacena datos específicos de miel
        honeyData[tokenId] = honeySpecific;
        
        // Almacena metadata CID
        _tokenMetadataCID[tokenId] = metadataCID;
        
        // Actualiza contador de certificados por nivel
        certificatesByLevel[honeySpecific.certificationLevel]++;
        
        emit HoneyCertificateIssued(
            tokenId,
            producerAddress,
            batchId,
            honeySpecific.certificationLevel,
            metadataCID,
            block.timestamp
        );
        
        return tokenId;
    }
    
    // ════════════════════════════════════════════════════════════
    // OVERRIDE - Abstract Functions
    // ════════════════════════════════════════════════════════════
    
    /**
     * @notice Valida datos específicos de miel
     * @dev Solo validaciones BÁSICAS de formato (NO business rules)
     *      El laudo PDF contiene la interpretación y clasificación
     */
    function _validateProductSpecificData(bytes memory data) 
        internal 
        pure
        override 
        returns (bool) 
    {
        HoneySpecificData memory honeySpecific = abi.decode(
            data,
            (HoneySpecificData)
        );
        
        require(
            honeySpecific.moisture > 0,
            "Moisture must be positive"
        );
        
        require(
            bytes(honeySpecific.floralSource).length > 0,
            "Floral source required"
        );
        
        // Si tiene certificación oficial, debe tener número
        if (honeySpecific.certificationLevel != CertificationLevel.NONE) {
            require(
                bytes(honeySpecific.certificationNumber).length > 0,
                "Certification number required"
            );
        }
              
        return true;
    }
    
    /**
     * @notice Retorna tipo de producto
     * @dev Implementación de la función abstracta del BaseCertificateNFT
     */
    function _getProductType() 
        internal 
        pure
        override 
        returns (string memory) 
    {
        return "HONEY";
    }
    
    // ════════════════════════════════════════════════════════════
    // TOKEN URI (ERC-721 Metadata)
    // ════════════════════════════════════════════════════════════
    
    /**
     * @notice Retorna URI de los metadatos (estándar ERC-721)
     * @dev Retorna IPFS URI con el metadata JSON completo
     * @param tokenId ID del certificado
     * @return URI completa (ej: "ipfs://QmXxx...")
     */
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override 
        returns (string memory) 
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        string memory cid = _tokenMetadataCID[tokenId];
        require(bytes(cid).length > 0, "Metadata CID not set");
        
        // Retorna: ipfs://QmXxx...
        return string(abi.encodePacked(_ipfsGateway, cid));
    }
    
    /**
     * @notice Actualiza gateway IPFS (si es necesario)
     * @dev Por defecto usa ipfs://, pero puede usar https://ipfs.io/ipfs/
     * @param newGateway Nueva gateway (ej: "https://ipfs.io/ipfs/")
     */
    function setIPFSGateway(string memory newGateway) 
        external 
        onlyOwner 
    {
        string memory oldGateway = _ipfsGateway;
        _ipfsGateway = newGateway;
        
        emit IPFSGatewayUpdated(oldGateway, newGateway, block.timestamp);
    }
    
    /**
     * @notice Retorna el gateway IPFS actual
     */
    function getIPFSGateway() 
        external 
        view 
        returns (string memory) 
    {
        return _ipfsGateway;
    }
    
    /**
     * @notice Retorna el CID de metadata directamente
     * @param tokenId ID del certificado
     * @return Metadata CID sin gateway
     */
    function getMetadataCID(uint256 tokenId) 
        external 
        view 
        returns (string memory) 
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _tokenMetadataCID[tokenId];
    }
    
    // ════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS 
    // ════════════════════════════════════════════════════════════
    
    /**
     * @notice Retorna certificado completo (base + específico)
     * @param tokenId ID del certificado
     * @return baseCert Datos base del certificado
     * @return honeySpecific Datos específicos de miel
     */
    function getFullCertificate(uint256 tokenId) 
        external 
        view 
        returns (
            BaseCertificate memory baseCert,
            HoneySpecificData memory honeySpecific
        ) 
    {
        require(_ownerOf(tokenId) != address(0), "Certificate does not exist");
        
        baseCert = _certificates[tokenId];
        honeySpecific = honeyData[tokenId];
        
        return (baseCert, honeySpecific);
    }
    
    /**
     * @notice Retorna solo datos específicos de miel
     */
    function getHoneyData(uint256 tokenId) 
        external 
        view 
        returns (HoneySpecificData memory) 
    {
        require(_ownerOf(tokenId) != address(0), "Certificate does not exist");
        return honeyData[tokenId];
    }
    
    /**
     * @notice Retorna nivel de certificación de un certificado
     */
    function getCertificationLevel(uint256 tokenId) 
        external 
        view 
        returns (CertificationLevel) 
    {
        require(_ownerOf(tokenId) != address(0), "Certificate does not exist");
        return honeyData[tokenId].certificationLevel;
    }
    
    /**
     * @notice Retorna estadísticas de certificados por nivel
     */
    function getCertificationStats() 
        external 
        view 
        returns (
            uint256 none,
            uint256 municipal,
            uint256 estadual,
            uint256 federal
        ) 
    {
        none = certificatesByLevel[CertificationLevel.NONE];
        municipal = certificatesByLevel[CertificationLevel.MUNICIPAL];
        estadual = certificatesByLevel[CertificationLevel.ESTADUAL];
        federal = certificatesByLevel[CertificationLevel.FEDERAL];
    }
    
    /**
     * @notice Verifica si miel puede ser exportada
     * @dev Requiere certificación FEDERAL (SIF)
     *      NO verifica calidad (eso está en el laudo PDF)
     */
    function canExport(uint256 tokenId) 
        external 
        view 
        returns (bool) 
    {
        require(_ownerOf(tokenId) != address(0), "Certificate does not exist");
        
        HoneySpecificData memory honey = honeyData[tokenId];
        
        // Solo verifica certificación FEDERAL (SIF)
        // Calidad se verifica en el laudo laboratorial (PDF en IPFS)
        return honey.certificationLevel == CertificationLevel.FEDERAL;
    }
    
    /**
     * @notice Retorna descripción legible del nivel de certificación
     */
    function getCertificationLevelDescription(CertificationLevel level) 
        external 
        pure 
        returns (string memory) 
    {
        if (level == CertificationLevel.NONE) return "Sin certificacion oficial";
        if (level == CertificationLevel.MUNICIPAL) return "SIM - Municipal";
        if (level == CertificationLevel.ESTADUAL) return "SIE - Estadual";
        if (level == CertificationLevel.FEDERAL) return "SIF - Federal";
        return "Unknown";
    }
}