// In-memory record store keyed by recordKey
const records = new Map();

let _counter = 1;

export function generateRecordKey() {
  return `rec_${Date.now()}_${_counter++}`;
}

export function saveRecord(recordKey, data) {
  records.set(recordKey, data);
}

export function getRecord(recordKey) {
  return records.get(recordKey) ?? null;
}
