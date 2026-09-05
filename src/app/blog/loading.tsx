import BootScreen from "@/components/BootScreen";

export default function BlogLoading() {
  return (
    <div className="boot-overlay">
      <BootScreen indeterminate />
    </div>
  );
}
