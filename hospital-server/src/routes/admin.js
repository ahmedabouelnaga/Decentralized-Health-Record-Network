import { Router } from 'express';
import { getPatient, postMessageOnChain, getContract, ethers } from '../chain.js';
import { eciesEncrypt, bytesToHex } from '../crypto.js';
import { generateRecordKey, saveRecord } from '../db.js';

const router = Router();

const MSG_POINTER_HANDOFF = ethers.encodeBytes32String('POINTER_HANDOFF');

router.post('/add', async (req, res) => {
  try {
    const { patientId, recordType, recordContent } = req.body;
    if (!patientId || !recordType || !recordContent) {
      return res.status(400).json({ error: 'missing fields' });
    }

    const patient = await getPatient(patientId);
    if (!patient.wallet || patient.wallet === ethers.ZeroAddress) {
      return res.status(404).json({ error: 'patient not found' });
    }

    const contract = getContract();
    const hospitalId = await contract.walletToHospitalId(await contract.runner.getAddress());
    const [, , , endpoint] = await contract.getHospital(hospitalId);

    const recordKey = generateRecordKey();
    const createdAt = Date.now();

    saveRecord(recordKey, {
      patientId,
      recordType,
      recordContent,
      recordKey,
      createdAt,
    });

    const pointer = JSON.stringify({
      hospitalId,
      hospitalEndpoint: endpoint,
      recordKey,
      recordType,
      createdAt,
    });

    const encryptedPointerBytes = await eciesEncrypt(patient.pubKey, pointer);
    const encryptedPointerHex = bytesToHex(encryptedPointerBytes);

    const bundle = JSON.stringify({
      hospitalId,
      encryptedPointer: encryptedPointerHex,
      recordTypePreview: recordType,
      createdAtPreview: createdAt,
    });

    const encryptedBundleBytes = await eciesEncrypt(patient.pubKey, bundle);

    await postMessageOnChain(patientId, MSG_POINTER_HANDOFF, encryptedBundleBytes);

    res.json({ success: true, recordKey });
  } catch (err) {
    console.error('admin/add error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
