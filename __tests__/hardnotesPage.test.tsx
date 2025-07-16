import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HardNotesPage from '../../app/hardnotes/page';
import QuillEditor from '@/components/quilleditor';

jest.mock('@/components/quilleditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="quill-editor" data-value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

describe('HardNotesPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('renders and loads initial tree', () => {
    render(<HardNotesPage />);
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.getByText('Algorithm Analysis')).toBeInTheDocument();
  });

  test('adds a folder', () => {
    render(<HardNotesPage />);
    fireEvent.click(screen.getByText('Folder'));
    expect(screen.getByText('New Folder')).toBeInTheDocument();
  });

  test('adds a note', () => {
    render(<HardNotesPage />);
    fireEvent.click(screen.getByText('Note'));
    expect(screen.getByText('New Note')).toBeInTheDocument();
  });

  test('edits note content', async () => {
    render(<HardNotesPage />);
    fireEvent.click(screen.getByText('Algorithm Analysis'));
    const editor = screen.getByTestId('quill-editor');
    fireEvent.change(editor, { target: { value: '<p>New content</p>' } });
    await waitFor(() => expect(editor.getAttribute('data-value')).toBe('<p>New content</p>'));
  });

  test('removes a note', () => {
    render(<HardNotesPage />);
    fireEvent.click(screen.getByText('Algorithm Analysis'));
    fireEvent.click(screen.getAllByText('Delete')[0]);
    expect(screen.queryByText('Algorithm Analysis')).not.toBeInTheDocument();
  });
});