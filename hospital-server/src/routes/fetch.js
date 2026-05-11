import { Router } from 'express';
import { getGrant, getPatient, getDoctor, logAccessOnChain, getContract, ethers } from '../chain.js';
import { getRecord } from '../db.js';

const router = Router();

const DOMAIN_NAME = 'HealthRegistry';
const DOMAIN_VERSION = '1';

const PATIENT_GRANT_TYPES = {
  PatientGrantAuth: [
    { name: 'doctorId', type: 'bytes32' },
    { name: 'expiry', type: 'uint256' },
  ],
};

const DOCTOR_FETCH_TYPES = {
  DoctorFetchAuth: [
    { name: 'grantId', type: 'bytes32' },
    { name: 'recordKey', type: 'string' },
  ],
};

router.post('/', async (req, res) => {
  try {
    const { grantId, recordPointer, patientSignature, doctorSignature } = req.body;

    if (!grantId || !recordPointer || !patientSignature || !doctorSignature) {
      return res.status(400).json({ error: 'missing fields' });
    }

    const { recordKey } = recordPointer;

    const contract = getContract();

    const grant = await getGrant(grantId);
    if (!grant || grant.grantId === ethers.ZeroHash) {
      return res.status(403).json({ error: 'grant not found' });
    }
    if (grant.revoked) {
      return res.status(403).json({ error: 'grant revoked' });
    }
    if (BigInt(Math.floor(Date.now() / 1000)) > grant.expiry) {
      return res.status(403).json({ error: 'grant expired' });
    }

    const network = await contract.runner.provider.getNetwork();
    const domain = {
      name: DOMAIN_NAME,
      version: DOMAIN_VERSION,
      chainId: Number(network.chainId),
      verifyingContract: contract.target,
    };

    const patient = await getPatient(grant.patientId);
    const recoveredPatient = ethers.verifyTypedData(
      domain,
      PATIENT_GRANT_TYPES,
      { doctorId: grant.doctorId, expiry: grant.expiry },
      patientSignature
    );
    if (recoveredPatient.toLowerCase() !== patient.wallet.toLowerCase()) {
      return res.status(401).json({ error: 'patient signature invalid' });
    }

    const doctor = await getDoctor(grant.doctorId);
    const recoveredDoctor = ethers.verifyTypedData(
      domain,
      DOCTOR_FETCH_TYPES,
      { grantId, recordKey },
      doctorSignature
    );
    if (recoveredDoctor.toLowerCase() !== doctor.wallet.toLowerCase()) {
      return res.status(401).json({ error: 'doctor signature invalid' });
    }

    const stored = getRecord(recordKey);
    if (!stored) {
      return res.status(404).json({ error: 'record not found' });
    }

    const recordBody = JSON.stringify(stored);
    const logTxHash = await logAccessOnChain(grantId, recordBody);

    res.json({ record: stored, logTxHash });
  } catch (err) {
    console.error('fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
