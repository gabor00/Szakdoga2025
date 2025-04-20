// ui/dialog.tsx
import * as React from "react";
import { X } from "lucide-react";

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (_open: boolean) => void;
  children: React.ReactNode;
}

export interface DialogContext {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}

const DialogContext = React.createContext<DialogContext | null>(null);

export const useDialog = () => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a Dialog component");
  }
  return context;
};

const Dialog: React.FC<DialogProps> = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  
  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  }, [isControlled, onOpenChange]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

Dialog.displayName = "Dialog";

export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ children, asChild = false, ...props }, ref) => {
    const { onOpenChange } = useDialog();
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      props.onClick?.(e);
      onOpenChange(true);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(
        children as React.ReactElement<React.ComponentPropsWithRef<'button'>>,
        {
          ...props,
          onClick: handleClick,
          ref,
        }
      );
    }

    return (
      <button 
        type="button" 
        ref={ref} 
        onClick={handleClick} 
        {...props}
      >
        {children}
      </button>
    );
  }
);


DialogTrigger.displayName = "DialogTrigger";

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  onEscapeKeyDown?: (_event: KeyboardEvent) => void;
  onPointerDownOutside?: (_event: PointerEvent) => void;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ children, onEscapeKeyDown, onPointerDownOutside, className, ...props }, ref) => {
    const { open, onOpenChange } = useDialog();
    const contentRef = React.useRef<HTMLDivElement>(null);
    
    React.useEffect(() => {
      if (!open) return;
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onEscapeKeyDown?.(e);
          onOpenChange(false);
        }
      };
      
      const handlePointerDown = (e: PointerEvent) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
          onPointerDownOutside?.(e);
          onOpenChange(false);
        }
      };
      
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("pointerdown", handlePointerDown);
      
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("pointerdown", handlePointerDown);
      };
    }, [open, onOpenChange, onEscapeKeyDown, onPointerDownOutside]);
    
    if (!open) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div
          ref={mergeRefs(ref, contentRef)}
          className={`fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg ${className}`}
          {...props}
        >
          {children}
          <button
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </div>
    );
  }
);

DialogContent.displayName = "DialogContent";

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const DialogHeader = ({ className, ...props }: DialogHeaderProps) => (
  <div
    className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`}
    {...props}
  />
);

DialogHeader.displayName = "DialogHeader";

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const DialogFooter = ({ className, ...props }: DialogFooterProps) => (
  <div
    className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}
    {...props}
  />
);

DialogFooter.displayName = "DialogFooter";

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode;
}

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={`text-lg font-semibold leading-none tracking-tight ${className}`}
      {...props}
    />
  )
);

DialogTitle.displayName = "DialogTitle";

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={`text-sm text-muted-foreground ${className}`}
      {...props}
    />
  )
);

DialogDescription.displayName = "DialogDescription";

const DialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, ...props }, ref) => {
  const { onOpenChange } = useDialog();
  
  return (
    <button
      type="button"
      ref={ref}
      onClick={() => onOpenChange(false)}
      {...props}
    >
      {children}
    </button>
  );
});

DialogClose.displayName = "DialogClose";

// Helper function to merge refs
function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (value: T) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T>).current = value;
      }
    });
  };
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};