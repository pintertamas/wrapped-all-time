/** Visible environment label (staging: "TEST SITE"). Renders nothing when the label is empty. */
export default function EnvLabel({ label }: { label: string }) {
  if (label === "") return null;
  return (
    <div className="env-label" role="note">
      {label}
    </div>
  );
}
