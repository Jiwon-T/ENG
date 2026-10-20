import {DIRECTORY_ROWS, directoryRowKey} from '../../api/_lib/academyDirectorySource.js';

/** The student's directory row with its 등록상태 (the coupon list shows 등록 students only). */
export const enrol = (f: any, key: string, status = '등록') => f.rows.set(`${DIRECTORY_ROWS}/${directoryRowKey('students', key)}`, {kind: 'students', academyId: 'main', fields: {properties: {'등록상태': {status: {name: status}}}}});
