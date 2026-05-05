// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HealthRegistry {
    struct Patient {
        bytes32 patientId;
        bytes   pubKey;
        address wallet;
    }

    struct Doctor {
        bytes32 doctorId;
        bytes   pubKey;
        address wallet;
    }

    struct Hospital {
        bytes32 hospitalId;
        bytes   pubKey;
        address wallet;
        string  endpoint;
    }

    struct AccessGrant {
        bytes32 grantId;
        bytes32 patientId;
        bytes32 doctorId;
        bytes32 hospitalId;
        bytes   encryptedPointerForDoctor;
        bytes   patientSig;
        uint256 expiry;
        bool    revoked;
        bool    used;
    }

    mapping(bytes32 => Patient)     private _patients;
    mapping(bytes32 => Doctor)      private _doctors;
    mapping(bytes32 => Hospital)    private _hospitals;
    mapping(bytes32 => AccessGrant) private _grants;
    mapping(bytes32 => bytes[])     private _pointers;

    mapping(address => bytes32) public walletToPatientId;
    mapping(address => bytes32) public walletToDoctorId;
    mapping(address => bytes32) public walletToHospitalId;

    uint256 private _nonce;

    event PatientRegistered(bytes32 indexed patientId, address wallet);
    event DoctorRegistered(bytes32 indexed doctorId, address wallet);
    event HospitalRegistered(bytes32 indexed hospitalId, address wallet, string endpoint);
    event PointerAdded(bytes32 indexed patientId, uint256 index);
    event GrantCreated(
        bytes32 indexed grantId,
        bytes32 indexed patientId,
        bytes32 indexed doctorId,
        bytes32 hospitalId,
        uint256 expiry
    );
    event GrantRevoked(bytes32 indexed grantId);
    event AccessLogged(
        bytes32 indexed grantId,
        bytes32 indexed patientId,
        bytes32 indexed hospitalId,
        bytes32 recordHash
    );
    event EncryptedMessage(
        bytes32 indexed recipientId,
        bytes32 indexed messageType,
        bytes payload
    );

    function registerPatient(bytes calldata pubKey) external returns (bytes32) {
        bytes32 id = keccak256(pubKey);
        require(_patients[id].wallet == address(0), "already registered");
        _patients[id] = Patient(id, pubKey, msg.sender);
        walletToPatientId[msg.sender] = id;
        emit PatientRegistered(id, msg.sender);
        return id;
    }

    function registerDoctor(bytes calldata pubKey) external returns (bytes32) {
        bytes32 id = keccak256(pubKey);
        require(_doctors[id].wallet == address(0), "already registered");
        _doctors[id] = Doctor(id, pubKey, msg.sender);
        walletToDoctorId[msg.sender] = id;
        emit DoctorRegistered(id, msg.sender);
        return id;
    }

    function registerHospital(bytes calldata pubKey, string calldata endpoint) external returns (bytes32) {
        bytes32 id = keccak256(pubKey);
        require(_hospitals[id].wallet == address(0), "already registered");
        _hospitals[id] = Hospital(id, pubKey, msg.sender, endpoint);
        walletToHospitalId[msg.sender] = id;
        emit HospitalRegistered(id, msg.sender, endpoint);
        return id;
    }

    function addPointer(bytes calldata encryptedPointer) external {
        bytes32 patientId = walletToPatientId[msg.sender];
        require(patientId != bytes32(0), "not registered as patient");
        _pointers[patientId].push(encryptedPointer);
        emit PointerAdded(patientId, _pointers[patientId].length - 1);
    }

    function createGrant(
        bytes32 doctorId,
        bytes32 hospitalId,
        bytes calldata encryptedPointerForDoctor,
        uint256 expiry,
        bytes calldata patientSig
    ) external returns (bytes32) {
        bytes32 patientId = walletToPatientId[msg.sender];
        require(patientId != bytes32(0), "not registered as patient");
        require(_doctors[doctorId].wallet != address(0), "unknown doctor");
        require(_hospitals[hospitalId].wallet != address(0), "unknown hospital");
        require(expiry > block.timestamp, "expiry in past");

        bytes32 grantId = keccak256(abi.encodePacked(patientId, doctorId, hospitalId, expiry, ++_nonce));
        _grants[grantId] = AccessGrant({
            grantId:                   grantId,
            patientId:                 patientId,
            doctorId:                  doctorId,
            hospitalId:                hospitalId,
            encryptedPointerForDoctor: encryptedPointerForDoctor,
            patientSig:                patientSig,
            expiry:                    expiry,
            revoked:                   false,
            used:                      false
        });

        emit GrantCreated(grantId, patientId, doctorId, hospitalId, expiry);
        return grantId;
    }

    function revokeGrant(bytes32 grantId) external {
        bytes32 patientId = walletToPatientId[msg.sender];
        require(patientId != bytes32(0), "not registered as patient");
        require(_grants[grantId].patientId == patientId, "not your grant");
        _grants[grantId].revoked = true;
        emit GrantRevoked(grantId);
    }

    function logAccess(bytes32 grantId, bytes32 recordHash) external {
        bytes32 hospitalId = walletToHospitalId[msg.sender];
        require(hospitalId != bytes32(0), "not registered as hospital");
        AccessGrant storage g = _grants[grantId];
        require(g.hospitalId == hospitalId, "wrong hospital");
        require(!g.revoked, "revoked");
        require(!g.used, "already used");
        require(block.timestamp <= g.expiry, "expired");
        g.used = true;
        emit AccessLogged(grantId, g.patientId, hospitalId, recordHash);
    }

    function postMessage(bytes32 recipientId, bytes32 messageType, bytes calldata payload) external {
        emit EncryptedMessage(recipientId, messageType, payload);
    }

    function getPointers(bytes32 patientId) external view returns (bytes[] memory) {
        return _pointers[patientId];
    }

    function getGrant(bytes32 grantId) external view returns (AccessGrant memory) {
        return _grants[grantId];
    }

    function getPatient(bytes32 patientId) external view returns (bytes32, bytes memory, address) {
        Patient memory p = _patients[patientId];
        return (p.patientId, p.pubKey, p.wallet);
    }

    function getDoctor(bytes32 doctorId) external view returns (bytes32, bytes memory, address) {
        Doctor memory d = _doctors[doctorId];
        return (d.doctorId, d.pubKey, d.wallet);
    }

    function getHospital(bytes32 hospitalId) external view returns (bytes32, bytes memory, address, string memory) {
        Hospital memory h = _hospitals[hospitalId];
        return (h.hospitalId, h.pubKey, h.wallet, h.endpoint);
    }
}
