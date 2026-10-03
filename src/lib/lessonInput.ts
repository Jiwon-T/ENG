// Old internal notes share one editor; parent feedback and plans remain stored.
export function compactLessonInput(value: any) {
  return { ...value, specialNote: [value.specialNote || '', value.attendanceNote ? `지각·결석: ${value.attendanceNote}` : ''].filter(Boolean).join('\n\n'), attendanceNote: '' };
}
