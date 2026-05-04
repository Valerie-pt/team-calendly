export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
          Запись на встречу
        </h1>
        <p className="text-text-secondary text-lg mb-2">
          Откройте ссылку, которую вам отправил организатор
        </p>
        <p className="text-text-secondary text-sm">
          У каждого типа встречи свой адрес
        </p>
      </div>
    </main>
  );
}
