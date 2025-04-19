// ui/slider.tsx
import * as React from "react";

export interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  sliderdefaultValue?: number[];
  value?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  orientation?: "horizontal" | "vertical";
  inverted?: boolean;
  showValueLabel?: boolean;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({
    className,
    sliderdefaultValue = [0],
    value,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    onValueChange,
    onValueCommit,
    orientation = "horizontal",
    inverted = false,
    showValueLabel = false,
    ...props
  }, ref) => {
    const isHorizontal = orientation === "horizontal";
    const [innerValue, setInnerValue] = React.useState<number[]>(sliderdefaultValue);
    const values = value !== undefined ? value : innerValue;
    const [isDragging, setIsDragging] = React.useState(false);
    const sliderRef = React.useRef<HTMLDivElement>(null);
    const thumbRefs = React.useRef<Array<HTMLDivElement | null>>(
      new Array(values.length).fill(null)
    );
    
    
    React.useEffect(() => {
      if (value !== undefined) {
        setInnerValue(value);
      }
    }, [value]);

    // Calculate percentage for positioning
    const getPercentage = (val: number) => {
      return ((val - min) / (max - min)) * 100;
    };
    
    // Function to get value from mouse/touch position
    const getValueFromPosition = (position: number) => {
      const sliderRect = sliderRef.current?.getBoundingClientRect();
      if (!sliderRect) return min;
      
      let percentage;
      if (isHorizontal) {
        percentage = ((position - sliderRect.left) / sliderRect.width);
      } else {
        percentage = ((sliderRect.bottom - position) / sliderRect.height);
      }
      
      if (inverted) percentage = 1 - percentage;
      
      percentage = Math.max(0, Math.min(percentage, 1));
      
      let newValue = min + percentage * (max - min);
      
      // Apply step
      newValue = Math.round(newValue / step) * step;
      
      // Ensure value is within bounds
      return Math.max(min, Math.min(max, newValue));
    };
    
    // Update the value based on user interaction
    const updateValue = (position: number, thumbIndex = 0) => {
      const newValue = getValueFromPosition(position);
      const newValues = [...values];
      newValues[thumbIndex] = newValue;
      
      // Sort values if there are multiple thumbs
      if (newValues.length > 1) {
        newValues.sort((a, b) => a - b);
      }
      
      if (!value) {
        setInnerValue(newValues);
      }
      
      onValueChange?.(newValues);
    };
    
    // Handle mouse/touch events
    const handlePointerDown = (e: React.PointerEvent, thumbIndex = 0) => {
      if (disabled) return;
      
      setIsDragging(true);
      
      // Set pointer capture to handle events outside of component
      const thumb = thumbRefs.current[thumbIndex];
      if (thumb) {
        thumb.setPointerCapture(e.pointerId);
      }
      
      // Update value based on initial position
      updateValue(isHorizontal ? e.clientX : e.clientY, thumbIndex);
    };
    
    const handlePointerMove = (e: React.PointerEvent, thumbIndex = 0) => {
      if (!isDragging || disabled) return;
      updateValue(isHorizontal ? e.clientX : e.clientY, thumbIndex);
    };
    
    const handlePointerUp = (e: React.PointerEvent, thumbIndex = 0) => {
      if (isDragging) {
        setIsDragging(false);
        onValueCommit?.(values);
        
        // Release pointer capture
        const thumb = thumbRefs.current[thumbIndex];
        if (thumb) {
          thumb.releasePointerCapture(e.pointerId);
        }
      }
    };
    
    const handleTrackClick = (e: React.MouseEvent) => {
      if (disabled) return;
      
      const trackRect = sliderRef.current?.getBoundingClientRect();
      if (!trackRect) return;
      
      // Find closest thumb if multiple
      let thumbIndex = 0;
      if (values.length > 1) {
        const clickValue = getValueFromPosition(isHorizontal ? e.clientX : e.clientY);
        const distances = values.map(val => Math.abs(val - clickValue));
        thumbIndex = distances.indexOf(Math.min(...distances));
      }
      
      updateValue(isHorizontal ? e.clientX : e.clientY, thumbIndex);
      onValueCommit?.(values);
    };
    
    return (
      <div
        ref={mergeRefs(ref, sliderRef)}
        className={`relative ${
          isHorizontal ? "h-5 w-full" : "h-full w-5"
        } touch-none ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
        onMouseDown={handleTrackClick}
        {...props}
      >
        {/* Track */}
        <div 
          className={`absolute ${
            isHorizontal 
              ? "h-2 w-full top-1.5" 
              : "h-full w-2 left-1.5"
          } rounded-full bg-secondary`}
        />
        
        {/* Range (filled part) */}
        {values.length === 1 ? (
          // Single thumb
          <div
            className={`absolute rounded-full bg-primary ${
              isHorizontal
                ? `h-2 top-1.5 ${inverted ? "right-0" : "left-0"}`
                : `w-2 left-1.5 ${inverted ? "top-0" : "bottom-0"}`
            }`}
            style={
              isHorizontal
                ? { width: `${getPercentage(values[0])}%` }
                : { height: `${getPercentage(values[0])}%` }
            }
          />
        ) : (
          // Range between thumbs
          <div
            className={`absolute rounded-full bg-primary ${
              isHorizontal ? "h-2 top-1.5" : "w-2 left-1.5"
            }`}
            style={
              isHorizontal
                ? {
                    left: `${getPercentage(values[0])}%`,
                    width: `${getPercentage(values[1]) - getPercentage(values[0])}%`,
                  }
                : {
                    bottom: `${getPercentage(values[0])}%`,
                    height: `${getPercentage(values[1]) - getPercentage(values[0])}%`,
                  }
            }
          />
        )}
        
        {/* Thumbs */}
        {values.map((val, i) => (
          <div
            key={i}
            ref={el => {thumbRefs.current[i] = el}}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={val}
            aria-disabled={disabled}
            className={`absolute flex items-center justify-center rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            } ${
              isHorizontal ? "top-0 h-5 w-5" : "left-0 h-5 w-5"
            }`}
            style={
              isHorizontal
                ? { left: `calc(${getPercentage(val)}% - 0.625rem)` }
                : { bottom: `calc(${getPercentage(val)}% - 0.625rem)` }
            }
            onPointerDown={e => handlePointerDown(e, i)}
            onPointerMove={e => handlePointerMove(e, i)}
            onPointerUp={e => handlePointerUp(e, i)}
          >
            {showValueLabel && (
              <div className="absolute bottom-full mb-2 text-xs font-medium">
                {val}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
);

Slider.displayName = "Slider";

// Helper function to merge refs
function mergeRefs<T>(...refs: (React.Ref<T> | undefined | null)[]) {
  return (value: T) => {
    refs.forEach(ref => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T>).current = value;
      }
    });
  };
}

export { Slider };