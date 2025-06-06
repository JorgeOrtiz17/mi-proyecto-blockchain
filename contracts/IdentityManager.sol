// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract IdentityManager {
    // Estructura para almacenar los datos de la identidad de un estudiante
    struct StudentIdentity {
        string name;
        string studentIDHash; // Un hash del ID real del estudiante (para privacidad, ej. SHA256(DNI))
        bool isValidated;      // True si la identidad ha sido validada por una autoridad
        address validatorAddress; // Dirección de la entidad que validó la identidad
        uint256 registeredAt;  // Timestamp de cuando la identidad fue registrada
    }

    // Mapeo de la dirección del estudiante a su identidad digital
    mapping(address => StudentIdentity) public studentIdentities;
    // Mapeo para identificar qué direcciones son validadores autorizados
    mapping(address => bool) public isValidator;

    // Eventos para rastrear acciones importantes en la cadena
    event IdentityRegistered(address indexed studentAddress, string name, string studentIDHash);
    event IdentityValidated(address indexed studentAddress, address indexed validatorAddress);
    event ValidatorAdded(address indexed newValidator, address indexed addedBy);

    // Constructor: Se ejecuta solo una vez al desplegar el contrato.
    // El que despliega el contrato se convierte automáticamente en el primer validador.
    constructor() {
        isValidator[msg.sender] = true;
        emit ValidatorAdded(msg.sender, address(0)); // address(0) para indicar que fue el deployer
    }

    /**
     * @dev Permite a un validador añadir una nueva dirección como validador.
     * Solo las direcciones que ya son validadores pueden llamar a esta función.
     * @param _newValidator Dirección de la nueva entidad validadora.
     */
    function addValidator(address _newValidator) public {
        // Requiere que el llamador sea un validador existente
        require(isValidator[msg.sender], "Caller is not a validator");
        // Requiere que la dirección no sea nula
        require(_newValidator != address(0), "Invalid address");
        // Requiere que la dirección no sea ya un validador
        require(!isValidator[_newValidator], "Address is already a validator");

        isValidator[_newValidator] = true;
        emit ValidatorAdded(_newValidator, msg.sender);
    }

    /**
     * @dev Permite a un estudiante registrar su identidad digital en la blockchain.
     * Un estudiante solo puede registrar una identidad por dirección de cartera.
     * @param _name Nombre completo del estudiante.
     * @param _studentIDHash Hash del identificador real del estudiante (ej. DNI/cédula).
     */
    function registerStudentIdentity(string memory _name, string memory _studentIDHash) public {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_studentIDHash).length > 0, "Student ID hash cannot be empty");
        // Requiere que la identidad no haya sido registrada previamente por esta dirección
        require(studentIdentities[msg.sender].registeredAt == 0, "Identity already registered");

        studentIdentities[msg.sender] = StudentIdentity({
            name: _name,
            studentIDHash: _studentIDHash,
            isValidated: false, // Inicialmente no validada
            validatorAddress: address(0), // Sin validador al principio
            registeredAt: block.timestamp
        });

        emit IdentityRegistered(msg.sender, _name, _studentIDHash);
    }

    /**
     * @dev Permite a una entidad validadora certificar la identidad de un estudiante.
     * La identidad debe existir y no haber sido validada previamente.
     * @param _studentAddress Dirección del estudiante cuya identidad se va a validar.
     */
    function validateIdentity(address _studentAddress) public {
        // Requiere que el llamador sea un validador autorizado
        require(isValidator[msg.sender], "Caller is not a validator");
        // Requiere que la identidad del estudiante ya esté registrada
        require(studentIdentities[_studentAddress].registeredAt != 0, "Student identity not registered");
        // Requiere que la identidad no haya sido validada previamente
        require(!studentIdentities[_studentAddress].isValidated, "Identity already validated");

        studentIdentities[_studentAddress].isValidated = true;
        studentIdentities[_studentAddress].validatorAddress = msg.sender; // Registra quién validó

        emit IdentityValidated(_studentAddress, msg.sender);
    }

    /**
     * @dev Permite a cualquier persona consultar la identidad de un estudiante.
     * Esta es una función `view`, por lo que no consume gas.
     * @param _studentAddress Dirección del estudiante a consultar.
     * @return name Nombre del estudiante.
     * @return studentIDHash Hash del ID del estudiante.
     * @return isValidated Si la identidad ha sido validada.
     * @return validatorAddress Dirección del validador.
     * @return registeredAt Marca de tiempo de registro.
     */
    function getStudentIdentity(address _studentAddress)
        public
        view
        returns (
            string memory name,
            string memory studentIDHash,
            bool isValidated,
            address validatorAddress,
            uint256 registeredAt
        )
    {
        StudentIdentity storage s = studentIdentities[_studentAddress];
        return (s.name, s.studentIDHash, s.isValidated, s.validatorAddress, s.registeredAt);
    }
}