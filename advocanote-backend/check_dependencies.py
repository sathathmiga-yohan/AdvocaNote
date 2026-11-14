
from app.main import app

print("\n========== ROUTER DEPENDENCY CHECK ==========")

found_error = False

for route in app.router.routes:

    context = getattr(route, "include_context", None)

    if context is None:
        continue

    original_router = getattr(
        route, "original_router", None
    )

    paths = [
        getattr(item, "path", "?")
        for item in getattr(
            original_router, "routes", []
        )
    ]

    dependencies = context.dependencies or []

    if not dependencies:
        continue

    print("\nRouter paths:", paths[:3])

    for index, dep in enumerate(dependencies, 1):
        function = getattr(dep, "dependency", None)

        print(f"Dependency {index}: {dep!r}")
        print(f"Function: {function!r}")
        print(f"Callable: {callable(function)}")

        if not callable(function):
            found_error = True
            print(">>> INVALID DEPENDENCY FOUND <<<")

if not found_error:
    print("\nNo invalid router dependencies found.")

print("\n=============================================")
