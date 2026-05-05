// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {HealthRegistry} from "../src/HealthRegistry.sol";

contract HealthRegistryTest is Test {
    HealthRegistry public registry;

    address patient1 = address(0x1);
    address doctor1  = address(0x2);
    address hospital1 = address(0x3);
    address attacker = address(0x9);

    bytes constant PATIENT_PUBKEY  = hex"04aabbccdd";
    bytes constant DOCTOR_PUBKEY   = hex"04eeff1122";
    bytes constant HOSPITAL_PUBKEY = hex"04334455aa";
    bytes constant ENC_POINTER     = hex"deadbeef01020304";
    bytes constant ENC_POINTER_DOC = hex"cafebabe05060708";
    bytes constant PATIENT_SIG     = hex"aabb";

    string constant ENDPOINT = "http://localhost:4000";

    bytes32 patientId;
    bytes32 doctorId;
    bytes32 hospitalId;

    function setUp() public {
        registry = new HealthRegistry();

        vm.prank(patient1);
        patientId = registry.registerPatient(PATIENT_PUBKEY);

        vm.prank(doctor1);
        doctorId = registry.registerDoctor(DOCTOR_PUBKEY);

        vm.prank(hospital1);
        hospitalId = registry.registerHospital(HOSPITAL_PUBKEY, ENDPOINT);
    }

    function test_RegisterPatient() public view {
        (bytes32 id, bytes memory pubKey, address wallet) = registry.getPatient(patientId);
        assertEq(id, patientId);
        assertEq(pubKey, PATIENT_PUBKEY);
        assertEq(wallet, patient1);
        assertEq(registry.walletToPatientId(patient1), patientId);
    }

    function test_RegisterDoctor() public view {
        (bytes32 id, bytes memory pubKey, address wallet) = registry.getDoctor(doctorId);
        assertEq(id, doctorId);
        assertEq(pubKey, DOCTOR_PUBKEY);
        assertEq(wallet, doctor1);
    }

    function test_RegisterHospital() public view {
        (bytes32 id, bytes memory pubKey, address wallet, string memory ep) = registry.getHospital(hospitalId);
        assertEq(id, hospitalId);
        assertEq(pubKey, HOSPITAL_PUBKEY);
        assertEq(wallet, hospital1);
        assertEq(ep, ENDPOINT);
    }

    function test_RegisterPatientTwiceSameKey() public {
        vm.prank(patient1);
        vm.expectRevert("already registered");
        registry.registerPatient(PATIENT_PUBKEY);
    }

    function test_AddPointer() public {
        vm.prank(patient1);
        registry.addPointer(ENC_POINTER);

        bytes[] memory ptrs = registry.getPointers(patientId);
        assertEq(ptrs.length, 1);
        assertEq(ptrs[0], ENC_POINTER);
    }

    function test_AddPointerUnregistered() public {
        vm.prank(attacker);
        vm.expectRevert("not registered as patient");
        registry.addPointer(ENC_POINTER);
    }

    function test_CreateGrant() public {
        uint256 expiry = block.timestamp + 1 days;

        vm.prank(patient1);
        vm.expectEmit(false, true, true, false);
        emit HealthRegistry.GrantCreated(bytes32(0), patientId, doctorId, hospitalId, expiry);
        bytes32 grantId = registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, expiry, PATIENT_SIG);

        HealthRegistry.AccessGrant memory g = registry.getGrant(grantId);
        assertEq(g.patientId, patientId);
        assertEq(g.doctorId, doctorId);
        assertEq(g.hospitalId, hospitalId);
        assertEq(g.expiry, expiry);
        assertFalse(g.revoked);
        assertFalse(g.used);
        assertEq(g.encryptedPointerForDoctor, ENC_POINTER_DOC);
        assertEq(g.patientSig, PATIENT_SIG);
    }

    function test_CreateGrantUnknownDoctor() public {
        vm.prank(patient1);
        vm.expectRevert("unknown doctor");
        registry.createGrant(bytes32(uint256(999)), hospitalId, ENC_POINTER_DOC, block.timestamp + 1 days, PATIENT_SIG);
    }

    function test_CreateGrantPastExpiry() public {
        vm.prank(patient1);
        vm.expectRevert("expiry in past");
        registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, block.timestamp - 1, PATIENT_SIG);
    }

    function test_RevokeGrant() public {
        vm.prank(patient1);
        bytes32 grantId = registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, block.timestamp + 1 days, PATIENT_SIG);

        vm.prank(patient1);
        vm.expectEmit(true, false, false, false);
        emit HealthRegistry.GrantRevoked(grantId);
        registry.revokeGrant(grantId);

        assertEq(registry.getGrant(grantId).revoked, true);
    }

    function test_RevokeGrantNotOwner() public {
        vm.prank(patient1);
        bytes32 grantId = registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, block.timestamp + 1 days, PATIENT_SIG);

        vm.prank(attacker);
        vm.expectRevert("not registered as patient");
        registry.revokeGrant(grantId);
    }

    function test_LogAccess() public {
        vm.prank(patient1);
        bytes32 grantId = registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, block.timestamp + 1 days, PATIENT_SIG);

        bytes32 recordHash = keccak256("record body");

        vm.prank(hospital1);
        vm.expectEmit(true, true, true, true);
        emit HealthRegistry.AccessLogged(grantId, patientId, hospitalId, recordHash);
        registry.logAccess(grantId, recordHash);

        assertEq(registry.getGrant(grantId).used, true);
    }

    function test_LogAccessWrongHospital() public {
        address hospital2 = address(0x4);
        vm.prank(hospital2);
        registry.registerHospital(hex"04deadbeef", "http://other:4000");

        vm.prank(patient1);
        bytes32 grantId = registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, block.timestamp + 1 days, PATIENT_SIG);

        vm.prank(hospital2);
        vm.expectRevert("wrong hospital");
        registry.logAccess(grantId, keccak256("record"));
    }

    function test_LogAccessRevoked() public {
        vm.prank(patient1);
        bytes32 grantId = registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, block.timestamp + 1 days, PATIENT_SIG);

        vm.prank(patient1);
        registry.revokeGrant(grantId);

        vm.prank(hospital1);
        vm.expectRevert("revoked");
        registry.logAccess(grantId, keccak256("record"));
    }

    function test_LogAccessExpired() public {
        uint256 expiry = block.timestamp + 1 hours;
        vm.prank(patient1);
        bytes32 grantId = registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, expiry, PATIENT_SIG);

        vm.warp(expiry + 1);

        vm.prank(hospital1);
        vm.expectRevert("expired");
        registry.logAccess(grantId, keccak256("record"));
    }

    function test_LogAccessAlreadyUsed() public {
        vm.prank(patient1);
        bytes32 grantId = registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, block.timestamp + 1 days, PATIENT_SIG);

        vm.prank(hospital1);
        registry.logAccess(grantId, keccak256("record"));

        vm.prank(hospital1);
        vm.expectRevert("already used");
        registry.logAccess(grantId, keccak256("record"));
    }

    function test_PostMessage() public {
        bytes32 recipientId = patientId;
        bytes32 msgType = keccak256("POINTER_HANDOFF");
        bytes memory payload = hex"1234";

        vm.expectEmit(true, true, false, true);
        emit HealthRegistry.EncryptedMessage(recipientId, msgType, payload);
        registry.postMessage(recipientId, msgType, payload);
    }

    function test_GetPointerMultiple() public {
        vm.startPrank(patient1);
        registry.addPointer(hex"aaaa");
        registry.addPointer(hex"bbbb");
        registry.addPointer(hex"cccc");
        vm.stopPrank();

        bytes[] memory ptrs = registry.getPointers(patientId);
        assertEq(ptrs.length, 3);
        assertEq(ptrs[1], hex"bbbb");
    }

    function test_GrantNonceUniqueness() public {
        uint256 expiry = block.timestamp + 1 days;

        vm.startPrank(patient1);
        bytes32 g1 = registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, expiry, PATIENT_SIG);
        bytes32 g2 = registry.createGrant(doctorId, hospitalId, ENC_POINTER_DOC, expiry, PATIENT_SIG);
        vm.stopPrank();

        assertTrue(g1 != g2);
    }
}
