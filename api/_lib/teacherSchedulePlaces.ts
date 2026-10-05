import { registrationNotion, type RegistrationNotion } from './teacherStudentRegistrationNotion.js';
export const SCHEDULE_DATABASE = '3430f1a4-9dde-4b4c-a5cf-0d11b913b38c';
export function schedulePlaceOptions(schema: any): string[] {
    const property = schema?.properties?.['장소'];
    if (property?.type !== 'select' || !Array.isArray(property.select?.options) || property.select.options.some((o: any) => typeof o.name !== 'string' || !o.name || o.name.length > 100))
        throw Error('NOTION_SCHEDULE_PLACE_SCHEMA_REQUIRED');
    return [...new Set<string>(property.select.options.map((o: any) => o.name))];
}
export async function readSchedulePlaceOptions(notion: RegistrationNotion = registrationNotion) {
    return schedulePlaceOptions(await notion(`databases/${SCHEDULE_DATABASE}`));
}
export function assertSchedulePlace(schema: any, place: string) {
    const options = schedulePlaceOptions(schema);
    if (place !== '' && !options.includes(place))
        throw Error('NOTION_SCHEDULE_PLACE_REQUIRED');
}
