import { useEffect } from "react";
import { Invert } from "mouse-animations";

export default function InvertDemo() {
useEffect(() => {
const invert = new Invert({
  color: '#ffffff',
  size: 64,
  smoothness: 0.5,
});
return () => invert.destroy();
}, []);

return <main style={ { minHeight: '100vh' } }>{/* your app */}</main>;
}