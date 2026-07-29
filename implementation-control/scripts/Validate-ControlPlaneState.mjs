import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const projectRoot = resolve(process.argv[2] ?? '.');
const issues = [];
const checks = [];

const posix = (value) => value.split(sep).join('/');
const shaBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readBytes = (path) => readFile(join(projectRoot, path));
const readText = async (path) => (await readBytes(path)).toString('utf8');
const readJson = async (path) => JSON.parse(await readText(path));

function check(id, condition, detail) {
  const status = Boolean(condition) ? 'PASS' : 'FAIL';
  checks.push({ id, status, detail });
  if (!condition) issues.push({ id, detail });
}

function sameArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}


function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  if (typeof value === 'number') return 'number';
  return typeof value;
}

function stableValueKey(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValueKey).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValueKey(value[key])}`).join(',')}}`;
}

function validateSchemaSubset(schema, value, instancePath = '$') {
  const errors = [];
  const expectedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const actualType = jsonType(value);
  if (expectedTypes.length > 0 && !expectedTypes.includes(actualType) && !(actualType === 'integer' && expectedTypes.includes('number'))) {
    return [`${instancePath}: type=${actualType}; expected=${expectedTypes.join('|')}`];
  }
  if (Object.hasOwn(schema, 'const') && stableValueKey(value) !== stableValueKey(schema.const)) {
    errors.push(`${instancePath}: const mismatch`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => stableValueKey(item) === stableValueKey(value))) {
    errors.push(`${instancePath}: value not in enum`);
  }
  if (typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) errors.push(`${instancePath}: minLength=${schema.minLength}`);
    if (typeof schema.pattern === 'string' && !(new RegExp(schema.pattern, 'u')).test(value)) errors.push(`${instancePath}: pattern=${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) errors.push(`${instancePath}: minimum=${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) errors.push(`${instancePath}: maximum=${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) errors.push(`${instancePath}: minItems=${schema.minItems}`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) errors.push(`${instancePath}: maxItems=${schema.maxItems}`);
    if (schema.uniqueItems === true) {
      const keys = value.map(stableValueKey);
      if (new Set(keys).size !== keys.length) errors.push(`${instancePath}: uniqueItems violated`);
    }
    if (schema.items && typeof schema.items === 'object') {
      value.forEach((item, index) => errors.push(...validateSchemaSubset(schema.items, item, `${instancePath}/${index}`)));
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (Number.isInteger(schema.minProperties) && keys.length < schema.minProperties) errors.push(`${instancePath}: minProperties=${schema.minProperties}`);
    if (Number.isInteger(schema.maxProperties) && keys.length > schema.maxProperties) errors.push(`${instancePath}: maxProperties=${schema.maxProperties}`);
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${instancePath}: missing required ${required}`);
    }
    const properties = schema.properties ?? {};
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) errors.push(...validateSchemaSubset(child, value[key], `${instancePath}/${key}`));
    }
    const unknown = keys.filter((key) => !Object.hasOwn(properties, key));
    if (schema.additionalProperties === false) {
      for (const key of unknown) errors.push(`${instancePath}: additionalProperty=${key}`);
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const key of unknown) errors.push(...validateSchemaSubset(schema.additionalProperties, value[key], `${instancePath}/${key}`));
    }
  }
  return errors;
}

function splitLinesKeepEndings(buffer) {
  const lines = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0x0a) {
      lines.push(buffer.subarray(start, index + 1));
      start = index + 1;
    }
  }
  if (start < buffer.length) lines.push(buffer.subarray(start));
  return lines;
}

async function listFiles(directory) {
  const root = join(projectRoot, directory);
  const output = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) output.push(absolute);
    }
  }
  await visit(root);
  return output.sort((a, b) => posix(relative(root, a)).localeCompare(posix(relative(root, b)), 'en'));
}

async function canonicalTreeHash(directory) {
  const root = join(projectRoot, directory);
  const files = await listFiles(directory);
  const stream = [];
  for (const absolute of files) {
    const rel = posix(relative(root, absolute));
    const hash = createHash('sha256').update(await readFile(absolute)).digest();
    stream.push(Buffer.from(rel, 'utf8'), Buffer.from([0]), hash, Buffer.from([10]));
  }
  return { count: files.length, sha256: shaBytes(Buffer.concat(stream)) };
}

try {
  const [lock, batchMap, state, metadata, authorityMatrix, documentationIndex, batchMapMarkdown, phaseStatus] = await Promise.all([
    readJson('implementation-control/TASK_SOURCE_LOCK.json'),
    readJson('implementation-control/IMPLEMENTATION_BATCH_MAP.json'),
    readJson('implementation-control/IMPLEMENTATION_STATE.json'),
    readJson('PACKAGE_METADATA.json'),
    readJson('implementation-control/AUTHORITY_MATRIX.json'),
    readText('DOCUMENTATION_INDEX.md'),
    readText('implementation-control/IMPLEMENTATION_BATCH_MAP.md'),
    readText('V0.21_PHASE_STATUS.md'),
  ]);

  const schemaSelfTest = {
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string' } },
    additionalProperties: false,
  };
  check('SCHEMA_SUBSET_SELF_TEST_VALID', validateSchemaSubset(schemaSelfTest, { name: 'FinScope' }).length === 0, 'valid fixture accepted');
  const schemaUnknownErrors = validateSchemaSubset(schemaSelfTest, { name: 'FinScope', unexpected: true });
  check('SCHEMA_SUBSET_SELF_TEST_UNKNOWN_PROPERTY', schemaUnknownErrors.some((entry) => entry.includes('additionalProperty=unexpected')), schemaUnknownErrors.join(' | '));

  const schemaBindings = [
    ['AUTHORITY_MATRIX', 'implementation-control/schemas/authority-matrix.schema.json', authorityMatrix],
    ['IMPLEMENTATION_BATCH_MAP', 'implementation-control/schemas/implementation-batch-map.schema.json', batchMap],
    ['IMPLEMENTATION_STATE', 'implementation-control/schemas/implementation-state.schema.json', state],
    ['TASK_SOURCE_LOCK', 'implementation-control/schemas/task-source-lock.schema.json', lock],
  ];
  for (const [id, schemaPath, document] of schemaBindings) {
    const schema = await readJson(schemaPath);
    const schemaErrors = validateSchemaSubset(schema, document);
    check(`SCHEMA_CONFORMANCE_${id}`, schemaErrors.length === 0, schemaErrors.length === 0 ? schemaPath : schemaErrors.slice(0, 20).join(' | '));
  }
  const implementationBatchSchema = await readJson('implementation-control/schemas/implementation-batch.schema.json');
  for (const name of (await readdir(join(projectRoot, 'implementation-control/batches'))).filter((value) => /^B\d{2}\.json$/u.test(value)).sort()) {
    const batchSchemaErrors = validateSchemaSubset(implementationBatchSchema, await readJson(`implementation-control/batches/${name}`));
    check(`SCHEMA_CONFORMANCE_${name.replace('.json', '')}`, batchSchemaErrors.length === 0, batchSchemaErrors.length === 0 ? name : batchSchemaErrors.slice(0, 20).join(' | '));
  }

  const tasksPath = String(lock.taskAuthority);
  const tasksBytes = await readBytes(tasksPath);
  const tasksSha256 = shaBytes(tasksBytes);
  check('TASKS_FILE_HASH', tasksSha256 === lock.tasksFileSha256, `${tasksPath}: ${tasksSha256}`);
  check('STATE_TASKS_HASH', state.sourceTasksSha256 === tasksSha256, `state=${state.sourceTasksSha256}`);
  check('MAP_TASKS_HASH', batchMap.sourceTasksSha256 === tasksSha256, `map=${batchMap.sourceTasksSha256}`);
  const markdownTasksHash = batchMapMarkdown.match(/\*\*SHA-256 de tareas:\*\* `([0-9a-f]{64})`/u)?.[1];
  check('MAP_MARKDOWN_TASKS_HASH', markdownTasksHash === tasksSha256, `markdown=${markdownTasksHash ?? 'missing'}`);

  const taskLines = splitLinesKeepEndings(tasksBytes);
  const lockedTasks = new Map();
  for (const task of lock.tasks ?? []) {
    const taskId = String(task.taskId);
    check(`TASK_UNIQUE_${taskId}`, !lockedTasks.has(taskId), taskId);
    lockedTasks.set(taskId, task);
    const lineNumber = Number(task.lineNumber);
    const line = taskLines[lineNumber - 1];
    check(`TASK_LINE_EXISTS_${taskId}`, Boolean(line), `line=${lineNumber}`);
    if (line) {
      check(`TASK_LINE_ID_${taskId}`, new RegExp(`^- \\[\\s?[Xx]?\\] ${taskId}\\b`, 'u').test(line.toString('utf8')), line.toString('utf8').trim());
      check(`TASK_LINE_HASH_${taskId}`, shaBytes(line) === task.sourceTaskSha256, `line=${lineNumber}`);
    }
  }
  check('TASK_COUNT', lockedTasks.size === 109, `count=${lockedTasks.size}`);

  const mapEntries = new Map((batchMap.batches ?? []).map((entry) => [String(entry.batchId), entry]));
  const lockedBatches = new Map();
  const allBatchTaskIds = [];
  for (const item of lock.batches ?? []) {
    const batchId = String(item.batchId);
    check(`BATCH_UNIQUE_${batchId}`, !lockedBatches.has(batchId), batchId);
    lockedBatches.set(batchId, item);
    const batchBytes = await readBytes(String(item.path));
    const actualBatchSha256 = shaBytes(batchBytes);
    check(`BATCH_FILE_HASH_${batchId}`, actualBatchSha256 === item.sha256, `${item.path}: ${actualBatchSha256}`);

    const batch = JSON.parse(batchBytes.toString('utf8'));
    check(`BATCH_ID_${batchId}`, batch.batchId === batchId, `document=${batch.batchId}`);
    check(`BATCH_SOURCE_TASKS_HASH_${batchId}`, batch.sourceTasksSha256 === tasksSha256, `batch=${batch.sourceTasksSha256}`);
    const taskIds = (batch.tasks ?? []).map((task) => String(task.id));
    allBatchTaskIds.push(...taskIds);
    check(`BATCH_TASK_COUNT_${batchId}`, batch.taskCount === taskIds.length, `declared=${batch.taskCount}; actual=${taskIds.length}`);
    check(`BATCH_EXECUTION_ORDER_${batchId}`, sameArray(batch.executionOrder, taskIds), JSON.stringify(batch.executionOrder));

    for (const task of batch.tasks ?? []) {
      const locked = lockedTasks.get(String(task.id));
      check(`BATCH_TASK_LOCKED_${batchId}_${task.id}`, Boolean(locked), String(task.id));
      if (locked) {
        check(`BATCH_TASK_HASH_${batchId}_${task.id}`, task.sourceTaskSha256 === locked.sourceTaskSha256, String(task.id));
      }
    }

    const mapEntry = mapEntries.get(batchId);
    check(`MAP_ENTRY_${batchId}`, Boolean(mapEntry), batchId);
    if (mapEntry) {
      check(`MAP_PATH_${batchId}`, mapEntry.batchFile === item.path, String(mapEntry.batchFile));
      check(`MAP_TASK_IDS_${batchId}`, sameArray(mapEntry.taskIds, taskIds), JSON.stringify(mapEntry.taskIds));
      check(`MAP_TASK_COUNT_${batchId}`, mapEntry.taskCount === taskIds.length, String(mapEntry.taskCount));
      check(`MAP_STATE_STATUS_${batchId}`, mapEntry.status === state.batchStatus?.[batchId], `${mapEntry.status}/${state.batchStatus?.[batchId]}`);
      check(`BATCH_STATE_STATUS_${batchId}`, batch.status === state.batchStatus?.[batchId], `${batch.status}/${state.batchStatus?.[batchId]}`);
    }
  }
  check('BATCH_COUNT', lockedBatches.size === 25, `count=${lockedBatches.size}`);
  check('MAP_BATCH_COUNT', batchMap.batchCount === lockedBatches.size && mapEntries.size === lockedBatches.size, `declared=${batchMap.batchCount}; actual=${mapEntries.size}`);
  check('MAP_TASK_COUNT', batchMap.taskCount === lockedTasks.size, `declared=${batchMap.taskCount}; actual=${lockedTasks.size}`);

  const batchTaskCounts = new Map();
  for (const taskId of allBatchTaskIds) batchTaskCounts.set(taskId, (batchTaskCounts.get(taskId) ?? 0) + 1);
  check('BATCH_TASK_COVERAGE', batchTaskCounts.size === lockedTasks.size && [...lockedTasks.keys()].every((id) => batchTaskCounts.get(id) === 1), `covered=${batchTaskCounts.size}`);

  const stateTaskIds = Object.keys(state.taskStatus ?? {}).sort();
  const lockTaskIds = [...lockedTasks.keys()].sort();
  const stateBatchIds = Object.keys(state.batchStatus ?? {}).sort();
  const lockBatchIds = [...lockedBatches.keys()].sort();
  check('STATE_TASK_KEYS', sameArray(stateTaskIds, lockTaskIds), `state=${stateTaskIds.length}; lock=${lockTaskIds.length}`);
  check('STATE_BATCH_KEYS', sameArray(stateBatchIds, lockBatchIds), `state=${stateBatchIds.length}; lock=${lockBatchIds.length}`);

  const completedTasks = Object.entries(state.taskStatus ?? {}).filter(([, status]) => status === 'COMPLETED').map(([id]) => id).sort();
  const completedBatches = Object.entries(state.batchStatus ?? {}).filter(([, status]) => status === 'COMPLETED').map(([id]) => id).sort();
  check('STATE_COMPLETED_TASKS', sameArray([...(state.completedTaskIds ?? [])].sort(), completedTasks), JSON.stringify(completedTasks));
  check('STATE_COMPLETED_BATCHES', sameArray([...(state.completedBatchIds ?? [])].sort(), completedBatches), JSON.stringify(completedBatches));
  check('ACTIVE_NEXT_BATCH', state.activeBatchId === state.nextAuthorizedBatchId, `${state.activeBatchId}/${state.nextAuthorizedBatchId}`);

  if (state.activeBatchId) {
    const activeLock = lockedBatches.get(String(state.activeBatchId));
    check('ACTIVE_BATCH_LOCKED', Boolean(activeLock), String(state.activeBatchId));
    if (activeLock) {
      const activeBatch = await readJson(String(activeLock.path));
      for (const dependency of activeBatch.externalDependencies ?? []) {
        check(`ACTIVE_DEPENDENCY_${dependency}`, state.taskStatus?.[dependency] === 'COMPLETED', `${dependency}=${state.taskStatus?.[dependency]}`);
      }
    }
  }

  check('DOCUMENTATION_ACTIVE_PHASE', documentationIndex.includes('V0.21_PHASE_STATUS.md'), 'DOCUMENTATION_INDEX.md');
  for (const [name, expected] of Object.entries(state.phaseGate ?? {})) {
    const match = phaseStatus.match(new RegExp(`${name}=(true|false)`, 'u'));
    check(`GATE_${name}`, Boolean(match) && (match[1] === 'true') === expected, match?.[0] ?? 'missing');
  }

  check('METADATA_REVISION', metadata.packageRevision === state.packageRevision, `${metadata.packageRevision}/${state.packageRevision}`);
  check('AUTHORITY_REVISION', authorityMatrix.packageRevision === state.packageRevision, `${authorityMatrix.packageRevision}/${state.packageRevision}`);
  check('METADATA_LOGICAL_NAME', metadata.logicalZipName === state.activePackageLogicalName, `${metadata.logicalZipName}/${state.activePackageLogicalName}`);
  check('METADATA_ROOT_DIRECTORY', metadata.rootDirectory === projectRoot.split(sep).at(-1), `${metadata.rootDirectory}/${projectRoot.split(sep).at(-1)}`);

  const instructionText = await readText('implementation-control/PROJECT_CONFIGURATION_INSTRUCTIONS.txt');
  check('INSTRUCTION_CHARACTER_COUNT', metadata.projectConfigurationInstructionCharacterCount === instructionText.length, `metadata=${metadata.projectConfigurationInstructionCharacterCount}; actual=${instructionText.length}`);
  check('INSTRUCTION_CHARACTER_LIMIT', instructionText.length <= 8000, `actual=${instructionText.length}`);

  const specify = await canonicalTreeHash('.specify');
  check('SPECIFY_FILE_COUNT', specify.count === 19, `count=${specify.count}`);
  check('SPECIFY_STATE_HASH', specify.sha256 === state.specifyTreeSha256, `${specify.sha256}/${state.specifyTreeSha256}`);
  check('SPECIFY_METADATA_HASH', specify.sha256 === metadata.specifyTreeSha256, `${specify.sha256}/${metadata.specifyTreeSha256}`);

  const controlFiles = [
    'implementation-control/TASK_SOURCE_LOCK.json',
    'implementation-control/IMPLEMENTATION_BATCH_MAP.json',
    'implementation-control/IMPLEMENTATION_STATE.json',
    'implementation-control/AUTHORITY_MATRIX.json',
  ];
  const controlFileHashes = {};
  for (const path of controlFiles) {
    const fileStat = await stat(join(projectRoot, path));
    check(`CONTROL_FILE_${path}`, fileStat.isFile(), path);
    controlFileHashes[path] = shaBytes(await readBytes(path));
  }

  const result = {
    schemaVersion: '1.0.0',
    projectRoot,
    status: issues.length === 0 ? 'PASS' : 'FAIL',
    checkCount: checks.length,
    passCount: checks.filter((entry) => entry.status === 'PASS').length,
    failCount: issues.length,
    taskCount: lockedTasks.size,
    batchCount: lockedBatches.size,
    tasksSha256,
    specifyTreeSha256: specify.sha256,
    controlFileHashes,
    checks,
    issues,
  };
  console.log(JSON.stringify(result, null, 2));
  if (issues.length === 0) console.error('CONTROL_PLANE_STATE_VALID');
  else console.error('CONTROL_PLANE_STATE_INVALID');
  process.exit(issues.length === 0 ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(2);
}
