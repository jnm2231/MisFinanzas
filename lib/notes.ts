import { File, Paths } from 'expo-file-system';

/**
 * Notas de backlog (ideas de nuevas funcionalidades).
 *
 * Se guardan en un archivo de texto plano dentro del almacenamiento de la app,
 * NO en la base de datos. Así no aparecen en las copias de seguridad (export
 * CSV/JSON) y no emborronan los datos financieros.
 */

const NOTES_FILE = 'backlog-notes.txt';

function notesFile(): File {
  return new File(Paths.document, NOTES_FILE);
}

export async function loadBacklogNotes(): Promise<string> {
  try {
    const file = notesFile();
    if (!file.exists) return '';
    return file.text();
  } catch {
    return '';
  }
}

export async function saveBacklogNotes(text: string): Promise<void> {
  const file = notesFile();
  if (file.exists) file.delete();
  file.create();
  file.write(text);
}
