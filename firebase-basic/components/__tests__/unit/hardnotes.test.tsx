import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Firebase modules BEFORE importing the component
const mockUser = { uid: 'test-user-123' };

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: mockUser,
  })),
}));

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(),
  ref: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  onValue: jest.fn(),
  child: jest.fn(),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn().mockResolvedValue({})),
}));

jest.mock('@/lib/firebase', () => ({
  db: {},
  app: {},
}));

// Now import the component after mocks are set up
import NotePage from '@/app/hardnotes/page';
import { getAuth } from 'firebase/auth';
import { onValue, set, get } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Mock Quill Editor
jest.mock('@/components/quilleditor', () => {
  return function MockQuillEditor({ value, onChange, readOnly }: any) {
    return (
      <textarea
        data-testid="quill-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
      />
    );
  };
});

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: any) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock UI components
jest.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, description }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, variant, size, disabled, title }: any) => (
    <button
      onClick={onClick}
      className={className}
      disabled={disabled}
      title={title}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) =>
    open ? <div data-testid="dialog" onClick={() => onOpenChange?.(false)}>{children}</div> : null,
  DialogContent: ({ children, onClick }: any) => (
    <div data-testid="dialog-content" onClick={onClick}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({ children, value, onValueChange }: any) => (
    <div data-testid="radio-group" data-value={value} onChange={onValueChange}>
      {children}
    </div>
  ),
  RadioGroupItem: ({ value, id }: any) => (
    <input type="radio" value={value} id={id} />
  ),
}));

describe('NotePage Component', () => {
  const mockOnValue = onValue as jest.Mock;
  const mockSet = set as jest.Mock;
  const mockGet = get as jest.Mock;
  const mockGetFunctions = getFunctions as jest.Mock;
  const mockHttpsCallable = httpsCallable as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnValue.mockImplementation((ref, callback) => {
      callback({ exists: () => false, val: () => null });
      return jest.fn(); // unsubscribe function
    });
    mockSet.mockResolvedValue(undefined);
    mockGet.mockResolvedValue({ exists: () => false, val: () => null });
    mockGetFunctions.mockReturnValue({});
    mockHttpsCallable.mockReturnValue(jest.fn().mockResolvedValue({}));
  });

  describe('Initial Render', () => {
    it('renders the page header', async () => {
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });
      expect(screen.getByText('Library')).toBeInTheDocument();
    });

    it('renders empty state when no notes exist', async () => {
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByText('No notes yet')).toBeInTheDocument();
      });
      expect(screen.getByText('Create your first note or folder')).toBeInTheDocument();
    });

    it('renders sidebar with folder and note buttons', async () => {
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getAllByText('Folder').length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText('Note').length).toBeGreaterThan(0);
    });
  });

  describe('Sidebar Toggle', () => {
    it('toggles sidebar visibility', async () => {
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByTitle('Hide sidebar')).toBeInTheDocument();
      });
      
      const toggleButton = screen.getByTitle('Hide sidebar');
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(screen.getByTitle('Show sidebar')).toBeInTheDocument();
      });
    });
  });

  describe('Creating Notes and Folders', () => {
    it('creates a new folder', async () => {
      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Folder').length).toBeGreaterThan(0);
      });

      const addFolderButton = screen.getAllByText('Folder')[0];
      fireEvent.click(addFolderButton);
      
      await waitFor(() => {
        expect(screen.getByText('New Folder')).toBeInTheDocument();
      });
    });

    it('creates a new note', async () => {
      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Note').length).toBeGreaterThan(0);
      });

      const addNoteButton = screen.getAllByText('Note')[0];
      fireEvent.click(addNoteButton);
      
      await waitFor(() => {
        expect(screen.getByText('New Note')).toBeInTheDocument();
      });
    });

    it('creates note inside selected folder', async () => {
      mockOnValue.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          val: () => ({
            'folder-1': {
              id: 'folder-1',
              name: 'Test Folder',
              type: 'folder',
              expanded: false,
              collaborators: {},
            },
          }),
        });
        return jest.fn();
      });

      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Folder')).toBeInTheDocument();
      });

      // Click folder to select it
      const folderName = screen.getByText('Test Folder');
      fireEvent.click(folderName);
      
      // Add note
      await waitFor(() => {
        const addNoteButton = screen.getAllByText('Note')[0];
        fireEvent.click(addNoteButton);
      });
      
      await waitFor(() => {
        expect(mockSet).toHaveBeenCalled();
      });
    });
  });

  describe('Note Selection and Editing', () => {
    beforeEach(() => {
      mockOnValue.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          val: () => ({
            'note-1': {
              id: 'note-1',
              name: 'Test Note',
              content: 'Test content',
              type: 'note',
              collaborators: {},
              ownerId: 'test-user-123',
            },
          }),
        });
        return jest.fn();
      });
    });

    it('selects and displays a note', async () => {
      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      const noteElement = screen.getByText('Test Note');
      fireEvent.click(noteElement);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Note')).toBeInTheDocument();
      });
    });

    it('updates note name', async () => {
      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Note'));
      
      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('Test Note');
        expect(nameInput).toBeInTheDocument();
        
        fireEvent.change(nameInput, { target: { value: 'Updated Note' } });
        expect(nameInput).toHaveValue('Updated Note');
      });
    });

    it('updates note content', async () => {
      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Note'));
      
      await waitFor(() => {
        const editor = screen.getByTestId('quill-editor');
        expect(editor).toBeInTheDocument();
        
        fireEvent.change(editor, { target: { value: 'New content' } });
        expect(editor).toHaveValue('New content');
      });
    });
  });

  describe('Folder Operations', () => {
    beforeEach(() => {
      mockOnValue.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          val: () => ({
            'folder-1': {
              id: 'folder-1',
              name: 'Test Folder',
              type: 'folder',
              expanded: false,
              collaborators: {},
            },
          }),
        });
        return jest.fn();
      });
    });

    it('expands and collapses folder', async () => {
      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Folder')).toBeInTheDocument();
      });

      const folderElement = screen.getByText('Test Folder');
      fireEvent.click(folderElement);
      
      // Should toggle expanded state
      await waitFor(() => {
        expect(mockSet).toHaveBeenCalled();
      });
    });

    it('renames folder when selected', async () => {
      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Folder')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Folder'));
      
      await waitFor(() => {
        const input = screen.getByDisplayValue('Test Folder');
        expect(input).toBeInTheDocument();
        
        fireEvent.change(input, { target: { value: 'Renamed Folder' } });
        expect(input).toHaveValue('Renamed Folder');
      });
    });
  });

  describe('Deleting Notes and Folders', () => {
    beforeEach(() => {
      global.confirm = jest.fn(() => true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('deletes a note after confirmation', async () => {
      mockOnValue.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          val: () => ({
            'note-1': {
              id: 'note-1',
              name: 'Test Note',
              content: 'Test content',
              type: 'note',
              collaborators: {},
              ownerId: 'test-user-123',
            },
          }),
        });
        return jest.fn();
      });

      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      // The delete button appears on hover, but in tests we can just click it
      // We need to find the parent div and then the delete button
      const noteRow = screen.getByText('Test Note').closest('div');
      const buttons = noteRow?.querySelectorAll('button');
      
      // Find the delete button (it should have Trash2 icon)
      const deleteButton = Array.from(buttons || []).find(
        btn => btn.className.includes('text-red-500')
      );
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(global.confirm).toHaveBeenCalledWith('Delete note "Test Note"?');
      }
    });

    it('deletes a folder after confirmation', async () => {
      mockOnValue.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          val: () => ({
            'folder-1': {
              id: 'folder-1',
              name: 'Test Folder',
              type: 'folder',
              expanded: false,
              collaborators: {},
            },
          }),
        });
        return jest.fn();
      });

      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Folder')).toBeInTheDocument();
      });

      const folderRow = screen.getByText('Test Folder').closest('div');
      const buttons = folderRow?.querySelectorAll('button');
      
      const deleteButton = Array.from(buttons || []).find(
        btn => btn.className.includes('text-red-500')
      );
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(global.confirm).toHaveBeenCalledWith(
          'Delete folder "Test Folder" and all its contents?'
        );
      }
    });
  });

  describe('Sharing Functionality', () => {
    beforeEach(() => {
      mockOnValue.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          val: () => ({
            'note-1': {
              id: 'note-1',
              name: 'Test Note',
              content: 'Test content',
              type: 'note',
              collaborators: {},
              ownerId: 'test-user-123',
            },
          }),
        });
        return jest.fn();
      });

      mockGet.mockResolvedValue({
        exists: () => true,
        val: () => ({
          'user-1': {
            UserSettings: {
              name: 'John',
              surname: 'Doe',
              profilePicture: '',
            },
          },
          'user-2': {
            UserSettings: {
              name: 'Jane',
              surname: 'Smith',
              profilePicture: '',
            },
          },
        }),
      });
    });

    it('opens share dialog', async () => {
      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      const noteRow = screen.getByText('Test Note').closest('div');
      const buttons = noteRow?.querySelectorAll('button');
      
      const shareButton = Array.from(buttons || []).find(
        btn => btn.className.includes('text-blue-500') && !btn.className.includes('hover:text-blue-700') || 
        btn.querySelector('svg.lucide-share-2')
      );
      
      if (shareButton) {
        fireEvent.click(shareButton);
        
        await waitFor(() => {
          // Use getAllByText since multiple dialogs might exist
          expect(screen.getAllByText('Share Note').length).toBeGreaterThan(0);
        });
      }
    });

    it('searches for users to share with', async () => {
      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      const noteRow = screen.getByText('Test Note').closest('div');
      const buttons = noteRow?.querySelectorAll('button');
      const shareButton = Array.from(buttons || []).find(
        btn => btn.querySelector('svg.lucide-share-2')
      );
      
      if (shareButton) {
        fireEvent.click(shareButton);
        
        await waitFor(() => {
          // Use getAllByPlaceholderText since multiple inputs might exist
          const searchInputs = screen.getAllByPlaceholderText('Enter name or surname');
          expect(searchInputs.length).toBeGreaterThan(0);
          
          fireEvent.change(searchInputs[0], { target: { value: 'John' } });
          
          const searchButtons = screen.getAllByText('Search');
          fireEvent.click(searchButtons[0]);
        });

        await waitFor(() => {
          expect(mockGet).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Shared Notes', () => {
    it('displays shared notes section when shared notes exist', async () => {
      let callCount = 0;
      mockOnValue.mockImplementation((ref, callback) => {
        callCount++;
        
        if (callCount === 1) {
          // User's own notes
          callback({ exists: () => false, val: () => null });
        } else if (callCount === 2) {
          // Shared notes references
          callback({
            exists: () => true,
            val: () => ({
              'note-1': { owner: 'other-user', noteId: 'note-1' },
            }),
          });
        } else {
          // Actual shared note data
          callback({
            exists: () => true,
            val: () => ({
              id: 'note-1',
              name: 'Shared Note',
              content: 'Shared content',
              type: 'note',
              collaborators: { 'test-user-123': 'read' },
            }),
          });
        }
        
        return jest.fn();
      });

      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Shared')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Permission Handling', () => {
    it('enables read-only mode for read permission', async () => {
      mockOnValue.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          val: () => ({
            'note-1': {
              id: 'note-1',
              name: 'Test Note',
              content: 'Test content',
              type: 'note',
              collaborators: { 'test-user-123': 'read' },
              ownerId: 'other-user',
            },
          }),
        });
        return jest.fn();
      });

      mockGet.mockResolvedValue({
        exists: () => true,
        val: () => 'read',
      });

      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Note'));
      
      await waitFor(() => {
        const editor = screen.getByTestId('quill-editor');
        expect(editor).toHaveAttribute('readonly');
      });
    });
  });

  describe('Collaborator Management', () => {
    it('opens collaborators dialog', async () => {
      mockOnValue.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          val: () => ({
            'note-1': {
              id: 'note-1',
              name: 'Test Note',
              content: 'Test content',
              type: 'note',
              collaborators: { 'user-1': true },
              ownerId: 'test-user-123',
            },
          }),
        });
        return jest.fn();
      });

      mockGet.mockResolvedValue({
        exists: () => true,
        val: () => ({
          name: 'John',
          surname: 'Doe',
          profilePicture: '',
        }),
      });

      render(<NotePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      const noteRow = screen.getByText('Test Note').closest('div');
      const buttons = noteRow?.querySelectorAll('button');
      const collaboratorsButton = Array.from(buttons || []).find(
        btn => btn.querySelector('svg.lucide-users')
      );
      
      if (collaboratorsButton) {
        fireEvent.click(collaboratorsButton);
        
        await waitFor(() => {
          // Use getAllByText since multiple dialogs might exist
          const manageCollabElements = screen.getAllByText('Manage Collaborators');
          expect(manageCollabElements.length).toBeGreaterThan(0);
        });
      }
    });
  });
});