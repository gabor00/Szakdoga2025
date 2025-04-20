// ui/select.tsx
import * as React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectOptionProps {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (_value: string) => void;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ value, defaultValue, onValueChange, disabled, name, placeholder, className, children }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedValue, setSelectedValue] = React.useState(value || defaultValue || "");
    const selectRef = React.useRef<HTMLDivElement>(null);

    // ...useEffects...

    return (
      <div ref={selectRef} className={`relative w-full ${className}`}>
        <div
          ref={ref}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          }`}
        >
          <span className={`${!selectedValue && "text-muted-foreground"}`}>
            {selectedValue
              ? React.Children.toArray(children).find(
                  (child): child is React.ReactElement<SelectOptionProps> =>
                    React.isValidElement<SelectOptionProps>(child) && child.props.value === selectedValue
                )?.props.children || selectedValue
              : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </div>

        {isOpen && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80">
            {children}
          </div>
        )}

        <select
          name={name}
          value={selectedValue}
          onChange={(e) => {
            setSelectedValue(e.target.value);
            onValueChange?.(e.target.value);
          }}
          disabled={disabled}
          className="sr-only"
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement<SelectOptionProps>(child)) {
              return (
                <option value={child.props.value} disabled={child.props.disabled}>
                  {child.props.children}
                </option>
              );
            }
            return null;
          })}
        </select>
      </div>
    );
  }
);


Select.displayName = "Select";

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    );
  }
);

SelectTrigger.displayName = "SelectTrigger";

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80 ${className}`}
        {...props}
      >
        <div className="p-1">
          {children}
        </div>
      </div>
    );
  }
);

SelectContent.displayName = "SelectContent";

export interface SelectItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  value: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

const SelectItem = React.forwardRef<HTMLLIElement, SelectItemProps>(
  ({ className, children, value, disabled, ...props }, ref) => {
    const selectContext = React.useContext(SelectContext);
    
    const handleClick = () => {
      if (!disabled && selectContext?.onValueChange) {
        selectContext.onValueChange(value);
        selectContext.setIsOpen(false);
      }
    };

    return (
      <li
        ref={ref}
        className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground ${
          disabled ? "pointer-events-none opacity-50" : "cursor-pointer"
        } ${className}`}
        onClick={handleClick}
        {...props}
      >
        {selectContext?.value === value && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
        )}
        {children}
      </li>
    );
  }
);

SelectItem.displayName = "SelectItem";

export interface SelectGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const SelectGroup = React.forwardRef<HTMLDivElement, SelectGroupProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        className={`space-y-1 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

SelectGroup.displayName = "SelectGroup";

export interface SelectLabelProps extends React.HTMLAttributes<HTMLLabelElement> {
  children?: React.ReactNode;
}

const SelectLabel = React.forwardRef<HTMLLabelElement, SelectLabelProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`px-2 py-1.5 text-sm font-semibold ${className}`}
        {...props}
      >
        {children}
      </label>
    );
  }
);

SelectLabel.displayName = "SelectLabel";

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
  children?: React.ReactNode;
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ className, placeholder, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`block truncate ${className}`}
        {...props}
      >
        {children || placeholder}
      </span>
    );
  }
);

SelectValue.displayName = "SelectValue";

// Context for Select component
interface SelectContextValue {
  value?: string;
  onValueChange?: (_value: string) => void;
  setIsOpen: (_isOpen: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
};
