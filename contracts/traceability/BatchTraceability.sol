// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

 /**
 * @title BatchTraceability
 * @notice Sistema de trazabilidad EPCIS 2.0
 * 
 * EPCIS 2.0 Compliant:
 * - 5 tipos de eventos estándar GS1
 * - Compatible con sistemas globales de supply chain
 * - Agnóstico de producto (mel, leche, café, etc)
 */
contract BatchTraceability is Ownable {

    // ════════════════════════════════════════════════════════════
    // ENUMS - EPCIS 2.0 Standard Event Types
    // ════════════════════════════════════════════════════════════
    
    /**
     * @notice Tipos de eventos EPCIS 2.0 (GS1 Standard)
     */
    enum EPCISEventType {
        OBJECT,           // ObjectEvent - observar/mover objetos
        AGGREGATION,      // AggregationEvent - agrupar/separar (pack/unpack)
        TRANSACTION,      // TransactionEvent - transacciones comerciales
        TRANSFORMATION,   // TransformationEvent - transformación física
        ASSOCIATION       // AssociationEvent - asociar objetos (ej: sensores IoT)
    }
    
    /**
     * @notice Acciones EPCIS estándar
     */
    enum EPCISAction {
        ADD,              // Agregar/crear/comisionar
        OBSERVE,          // Observar sin cambio de estado
        DELETE            // Remover/decomisionar
    }

    // ════════════════════════════════════════════════════════════
    // STRUCTS 
    // ════════════════════════════════════════════════════════════
    
    /**
     * @notice Operación de trazabilidad
     * 
     * Campos:
     * - operationId: Identificador único secuencial
     * - eventType: Tipo de evento EPCIS (5 tipos estándar)
     * - action: ADD, OBSERVE, o DELETE
     * - epc: Electronic Product Code principal (URN format)
     * - certificateTokenId: Referencia al NFT certificado origen
     * - actor: Address que ejecutó la operación
     * - eventTime: Timestamp del evento
     * - epcisHash: SHA-256 hash del EPCIS 2.0 completo (off-chain)
     */
    struct Operation {
        uint256 operationId;
        EPCISEventType eventType;
        EPCISAction action;
        string epc;                    // ej: "urn:epc:id:sgtin:789.12345.LOTE-2025-001"
        uint256 certificateTokenId;
        address actor;
        uint256 eventTime;
        bytes32 epcisHash;            // Hash del documento completo (off-chain)
    }

    // ════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ════════════════════════════════════════════════════════════
    
    // Contador de operaciones
    uint256 private _nextOperationId;
    
    // Todas las operaciones (operationId => Operation)
    mapping(uint256 => Operation) public operations;
    
    // Control de acceso (quién puede registrar operaciones)
    mapping(address => bool) public authorizedOperators;

    // ════════════════════════════════════════════════════════════
    // EVENTS
    // ════════════════════════════════════════════════════════════
    
    /**
     * @notice Emitido cuando se registra una operación
     * @dev Backend escucha este evento para sincronizar DB off-chain
     * 
     * @param operationId ID único de la operación
     * @param eventType Tipo de evento EPCIS
     * @param epc EPC principal del evento
     * @param certificateTokenId Token ID del certificado relacionado
     * @param actor Address que ejecutó
     * @param epcisHash Hash del EPCIS completo
     * @param eventTime Timestamp del evento
     */
    event OperationRecorded(
        uint256 indexed operationId,
        EPCISEventType indexed eventType,
        string epc,
        uint256 indexed certificateTokenId,
        address actor,
        bytes32 epcisHash,
        uint256 eventTime
    );
    
    /**
     * @notice Operador autorizado
     */
    event OperatorAuthorized(
        address indexed operator,
        address indexed authorizedBy,
        uint256 timestamp
    );
    
    /**
     * @notice Operador revocado
     */
    event OperatorRevoked(
        address indexed operator,
        address indexed revokedBy,
        uint256 timestamp
    );

    // ════════════════════════════════════════════════════════════
    // MODIFIERS
    // ════════════════════════════════════════════════════════════
    
    modifier onlyAuthorizedOperator() {
        require(
            authorizedOperators[msg.sender] || msg.sender == owner(),
            "Not authorized operator"
        );
        _;
    }

    constructor() Ownable(msg.sender) {
        _nextOperationId = 1; 
    }

    // ════════════════════════════════════════════════════════════
    // MAIN FUNCTION - Record Operation 
    // ════════════════════════════════════════════════════════════
    
    /**
     * @notice Registra operación de trazabilidad
     * @dev Solo guarda datos esenciales + hash. Backend tiene datos completos.
     * 
     * Flujo:
     * 1. Backend genera EPCIS completo (off-chain)
     * 2. Backend calcula SHA-256 hash del EPCIS
     * 3. Backend llama esta función con hash
     * 4. Blockchain guarda operación + hash
     * 5. Backend escucha evento y guarda EPCIS completo en DB
     * 6. Queries se hacen en DB, verificables con hash on-chain
     * 
     * @param eventType Tipo de evento EPCIS (OBJECT, AGGREGATION, etc)
     * @param action Acción EPCIS (ADD, OBSERVE, DELETE)
     * @param epc Electronic Product Code principal (URN format)
     *            Ejemplos:
     *            - Instance: "urn:epc:id:sgtin:789.12345.LOTE-2025-001"
     *            - Class: "urn:epc:class:lgtin:789.12345.HONEY-MULTI"
     * @param certificateTokenId Token ID del certificado NFT relacionado
     * @param epcisHash SHA-256 hash del EPCIS 2.0 completo (off-chain)
     * @return operationId ID único de la operación registrada
     */
    function recordOperation(
        EPCISEventType eventType,
        EPCISAction action,
        string memory epc,
        uint256 certificateTokenId,
        bytes32 epcisHash
    ) external onlyAuthorizedOperator returns (uint256) {
        
        require(bytes(epc).length > 0, "EPC required");
        require(epcisHash != bytes32(0), "EPCIS hash required");
        
        uint256 operationId = _nextOperationId++;
        
        Operation memory op = Operation({
            operationId: operationId,
            eventType: eventType,
            action: action,
            epc: epc,
            certificateTokenId: certificateTokenId,
            actor: msg.sender,
            eventTime: block.timestamp,
            epcisHash: epcisHash
        });
        
        // Guardar en storage
        operations[operationId] = op;
        
        // Emitir evento para que backend sincronice
        emit OperationRecorded(
            operationId,
            eventType,
            epc,
            certificateTokenId,
            msg.sender,
            epcisHash,
            block.timestamp
        );
        
        return operationId;
    }

    // ════════════════════════════════════════════════════════════
    // ACCESS CONTROL
    // ════════════════════════════════════════════════════════════
    
    /**
     * @notice Autoriza operador para registrar operaciones
     * @param operator Address del operador (entreposto, transportadora, etc)
     */
    function authorizeOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid address");
        require(!authorizedOperators[operator], "Already authorized");
        
        authorizedOperators[operator] = true;
        
        emit OperatorAuthorized(operator, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Revoca autorización de operador
     * @param operator Address del operador a revocar
     */
    function revokeOperator(address operator) external onlyOwner {
        require(authorizedOperators[operator], "Not authorized");
        
        authorizedOperators[operator] = false;
        
        emit OperatorRevoked(operator, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Autoriza múltiples operadores en batch
     * @param operators Array de addresses a autorizar
     */
    function authorizeOperatorsBatch(address[] memory operators) external onlyOwner {
        for (uint i = 0; i < operators.length; i++) {
            address operator = operators[i];
            
            if (operator != address(0) && !authorizedOperators[operator]) {
                authorizedOperators[operator] = true;
                emit OperatorAuthorized(operator, msg.sender, block.timestamp);
            }
        }
    }

    // ════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ════════════════════════════════════════════════════════════
    
    /**
     * @notice Obtiene operación por ID
     * @dev Para verificación individual de hash
     * @param operationId ID de la operación
     * @return Operation struct completo
     */
    function getOperation(uint256 operationId) 
        external 
        view 
        returns (Operation memory) 
    {
        require(operationId > 0 && operationId < _nextOperationId, "Invalid operation ID");
        return operations[operationId];
    }
    
    /**
     * @notice Retorna total de operaciones registradas
     * @return uint256 Total de operaciones
     */
    function totalOperations() external view returns (uint256) {
        return _nextOperationId - 1;
    }
    
    /**
     * @notice Verifica si hash coincide (verificación de integridad)
     * @dev Usuario puede verificar que datos off-chain no fueron alterados
     * 
     * Uso:
     * 1. Usuario obtiene EPCIS de backend
     * 2. Usuario calcula hash SHA-256 del EPCIS
     * 3. Usuario llama esta función para comparar
     * 4. Si coincide = datos íntegros, si no = datos alterados
     * 
     * @param operationId ID de la operación
     * @param providedHash Hash para verificar
     * @return bool True si coincide, False si no
     */
    function verifyHash(uint256 operationId, bytes32 providedHash) 
        external 
        view 
        returns (bool) 
    {
        require(operationId > 0 && operationId < _nextOperationId, "Invalid operation ID");
        return operations[operationId].epcisHash == providedHash;
    }
    
    /**
     * @notice Verifica si address es operador autorizado
     * @param operator Address a verificar
     * @return bool True si está autorizado
     */
    function isAuthorizedOperator(address operator) 
        external 
        view 
        returns (bool) 
    {
        return authorizedOperators[operator] || operator == owner();
    }
}