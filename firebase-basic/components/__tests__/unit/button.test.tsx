import * as React from "react";
import { Button } from '../button';
import { fireEvent, render } from '@testing-library/react';
import "@testing-library/jest-dom";

// Mock for cn from @/lib/utils
jest.mock("@/lib/utils", () => {
  const actual = jest.requireActual("@/lib/utils");
  return {
    ...actual,
    cn: jest.mocked(jest.fn((...inputs: any[]) => inputs.filter(Boolean).join(' '))),
  };
});

// Mocks for dependencies
type MockComponentProps = {
  children?: React.ReactNode;
  onClick?: jest.Mock<any, any>;
  className?: string;
  disabled?: boolean;
  type?: string;
  tabIndex?: number;
  'aria-invalid'?: boolean;
  [key: string]: any;
};

// Mock for Slot from @radix-ui/react-slot
jest.mock("@radix-ui/react-slot", () => {
  const actual = jest.requireActual("@radix-ui/react-slot");
  return {
    ...actual,
    Slot: ({ children, ...props }: any) => <span data-mock-slot {...props}>{children}</span>,
  };
});

// Mock for cva from class-variance-authority
jest.mock("class-variance-authority", () => {
  const actual = jest.requireActual("class-variance-authority");
  return {
    ...actual,
    cva: jest.mocked(jest.fn((base: string) => {
      // Return a function that mimics the cva variant function
      return jest.mocked(jest.fn(({ variant, size, className }: any) => {
        // Compose a string to simulate className output
        return [
          base,
          variant ? `variant-${variant}` : 'variant-default',
          size ? `size-${size}` : 'size-default',
          className,
        ].filter(Boolean).join(' ');
      }));
    })),
  };
});

describe('Button() Button method', () => {
  // Happy Paths
  describe('Happy paths', () => {
    test('renders a default button with children and triggers onClick', () => {
      // This test ensures the Button renders with default props and handles click events.
      const handleClick = jest.mocked(jest.fn());
      const { getByText } = render(
        <Button onClick={handleClick as any as MockComponentProps['onClick']}>Click Me</Button>
      );
      const btn = getByText('Click Me');
      expect(btn).toBeInTheDocument();
      expect(btn.tagName.toLowerCase()).toBe('button');
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test('applies custom className and passes through to rendered element', () => {
      // This test checks that a custom className is merged into the button's class list.
      const { getByText } = render(
        <Button className="my-custom-class">Styled</Button>
      );
      const btn = getByText('Styled');
      expect(btn).toHaveClass('my-custom-class');
    });

    test('renders with variant and size props, affecting className', () => {
      // This test ensures that variant and size props affect the className as expected.
      const { getByText } = render(
        <Button variant="destructive" size="lg">Big Danger</Button>
      );
      const btn = getByText('Big Danger');
      expect(btn.className).toContain('variant-destructive');
      expect(btn.className).toContain('size-lg');
    });

    test('renders as a Slot when asChild is true', () => {
      // This test ensures that when asChild is true, the Slot component is used.
      const { getByText, container } = render(
        <Button asChild>
          <a href="/test">Link Child</a>
        </Button>
      );
      const link = getByText('Link Child');
      // The Slot mock renders a <span data-mock-slot>
      expect(container.querySelector('[data-mock-slot]')).toBeInTheDocument();
      expect(link.tagName.toLowerCase()).toBe('a');
    });

    test('passes arbitrary props to the rendered element', () => {
      // This test ensures that arbitrary props (like tabIndex) are passed through.
      const { getByText } = render(
        <Button tabIndex={3}>Tabbable</Button>
      );
      const btn = getByText('Tabbable');
      expect(btn).toHaveAttribute('tabindex', '3');
    });

    test('renders children elements (e.g., icon + text)', () => {
      // This test ensures that children (including elements) are rendered.
      const Icon = () => <svg data-testid="icon" />;
      const { getByText, getByTestId } = render(
        <Button>
          <Icon />
          Icon Button
        </Button>
      );
      expect(getByTestId('icon')).toBeInTheDocument();
      expect(getByText('Icon Button')).toBeInTheDocument();
    });

    test('applies disabled attribute and disables pointer events', () => {
      // This test ensures that the disabled prop disables the button.
      const handleClick = jest.mocked(jest.fn());
      const { getByText } = render(
        <Button disabled onClick={handleClick as any as MockComponentProps['onClick']}>Disabled</Button>
      );
      const btn = getByText('Disabled');
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    test('applies aria-invalid and related classes', () => {
      // This test ensures that aria-invalid is passed and affects className.
      const { getByText } = render(
        <Button aria-invalid={true}>Invalid</Button>
      );
      const btn = getByText('Invalid');
      expect(btn).toHaveAttribute('aria-invalid', 'true');
      // ClassName should include aria-invalid styles (simulated by cva mock)
      expect(btn.className).toContain('variant-default');
    });

    test('renders with type prop', () => {
      // This test ensures that the type prop is passed to the button.
      const { getByText } = render(
        <Button type="submit">Submit</Button>
      );
      const btn = getByText('Submit');
      expect(btn).toHaveAttribute('type', 'submit');
    });
  });

  // Edge Cases
  describe('Edge cases', () => {
    test('renders with empty children', () => {
      // This test ensures the Button can render with no children.
      const { container } = render(<Button />);
      const btn = container.querySelector('[data-slot="button"]');
      expect(btn).toBeInTheDocument();
      expect(btn).toBeEmptyDOMElement();
    });

    test('renders with valid variant and size edge cases', () => {
      // This test ensures that all valid variant/size combinations work.
      const { getByText: getByText1 } = render(
        <Button variant="link" size="sm">Link Small</Button>
      );
      const btn1 = getByText1('Link Small');
      expect(btn1.className).toContain('variant-link');
      expect(btn1.className).toContain('size-sm');

      const { getByText: getByText2 } = render(
        <Button variant="ghost" size="icon">Ghost Icon</Button>
      );
      const btn2 = getByText2('Ghost Icon');
      expect(btn2.className).toContain('variant-ghost');
      expect(btn2.className).toContain('size-icon');
    });

    test('renders asChild with a non-anchor element', () => {
      // This test ensures asChild works with elements other than <a>.
      const { getByText, container } = render(
        <Button asChild>
          <div>Div Child</div>
        </Button>
      );
      expect(container.querySelector('[data-mock-slot]')).toBeInTheDocument();
      expect(getByText('Div Child').tagName.toLowerCase()).toBe('div');
    });

    test('renders with a very long className', () => {
      // This test ensures that a long className string is handled.
      const longClass = 'x'.repeat(100); // Reduced length for practicality
      const { getByText } = render(
        <Button className={longClass}>LongClass</Button>
      );
      const btn = getByText('LongClass');
      expect(btn.className).toContain(longClass);
    });

    test('renders with null or undefined children', () => {
      // This test ensures that null/undefined children are handled gracefully.
      const { container: container1 } = render(
        <Button>{null}</Button>
      );
      const btn1 = container1.querySelector('[data-slot="button"]');
      expect(btn1).toBeInTheDocument();

      const { container: container2 } = render(
        <Button>{undefined}</Button>
      );
      const btn2 = container2.querySelector('[data-slot="button"]');
      expect(btn2).toBeInTheDocument();
    });

    test('renders with data attributes and custom props', () => {
      // This test ensures that custom data attributes are passed through.
      const { getByText } = render(
        <Button data-test-id="my-btn">DataAttr</Button>
      );
      const btn = getByText('DataAttr');
      expect(btn).toHaveAttribute('data-test-id', 'my-btn');
    });

    test('renders with multiple children and fragments', () => {
      // This test ensures that fragments and multiple children are rendered.
      const { getByText } = render(
        <Button>
          <>
            <span>First</span>
            <span>Second</span>
          </>
        </Button>
      );
      expect(getByText('First')).toBeInTheDocument();
      expect(getByText('Second')).toBeInTheDocument();
    });

    test('renders with a custom element as asChild', () => {
      // This test ensures asChild works with a custom React component.
      const Custom = ({ children, ...props }: any) => <section data-custom {...props}>{children}</section>;
      const { getByText, container } = render(
        <Button asChild>
          <Custom>Custom Child</Custom>
        </Button>
      );
      expect(container.querySelector('[data-mock-slot]')).toBeInTheDocument();
      expect(container.querySelector('section[data-custom]')).toBeInTheDocument();
      expect(getByText('Custom Child')).toBeInTheDocument();
    });

    test('renders with all valid variant options', () => {
      // This test ensures all valid variants work correctly.
      const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
      
      variants.forEach(variant => {
        const { getByText } = render(
          <Button variant={variant}>Test {variant}</Button>
        );
        const btn = getByText(`Test ${variant}`);
        expect(btn.className).toContain(`variant-${variant}`);
      });
    });

    test('renders with all valid size options', () => {
      // This test ensures all valid sizes work correctly.
      const sizes = ['default', 'sm', 'lg', 'icon'] as const;
      
      sizes.forEach(size => {
        const { getByText } = render(
          <Button size={size}>Test {size}</Button>
        );
        const btn = getByText(`Test ${size}`);
        expect(btn.className).toContain(`size-${size}`);
      });
    });

    test('handles boolean and string children properly', () => {
      // This test ensures different types of children are handled correctly.
      const { container: container1 } = render(
        <Button>{true}</Button>
      );
      const btn1 = container1.querySelector('[data-slot="button"]');
      expect(btn1).toBeInTheDocument();

      const { container: container2 } = render(
        <Button>{false}</Button>
      );
      const btn2 = container2.querySelector('[data-slot="button"]');
      expect(btn2).toBeInTheDocument();

      const { getByText } = render(
        <Button>{"String child"}</Button>
      );
      expect(getByText('String child')).toBeInTheDocument();
    });
  });
});