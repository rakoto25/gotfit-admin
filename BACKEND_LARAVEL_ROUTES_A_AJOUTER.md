# Routes Laravel nécessaires pour que le webadmin fonctionne complètement

Le webadmin appelle maintenant ces routes API avec le token Sanctum admin :

```php
// routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/users', [AdminUserController::class, 'index']);
    Route::post('/users', [AdminUserController::class, 'store']);
    Route::put('/users/{user}', [AdminUserController::class, 'update']);
    Route::delete('/users/{user}', [AdminUserController::class, 'destroy']);

    Route::get('/annonces', [AnnonceController::class, 'getAllAnnonce']);
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::get('/reservations', [ReservationController::class, 'getAllReservation']);
    Route::get('/payments', [PayementController::class, 'index']);
});
```

Exemple minimal de logique pour `AdminUserController` :

```php
public function index()
{
    return response()->json([
        'users' => User::with('roles')->latest()->get(),
    ]);
}

public function store(Request $request)
{
    $data = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'unique:users,email'],
        'password' => ['required', 'string', 'min:6'],
        'phone' => ['nullable', 'string', 'max:50'],
        'address' => ['nullable', 'string', 'max:255'],
        'bio' => ['nullable', 'string'],
        'status' => ['nullable', 'string'],
        'role_id' => ['nullable', 'integer', 'exists:roles,id'],
    ]);

    $user = User::create([
        'name' => $data['name'],
        'email' => $data['email'],
        'password' => Hash::make($data['password']),
        'phone' => $data['phone'] ?? null,
        'address' => $data['address'] ?? null,
        'bio' => $data['bio'] ?? null,
        'status' => $data['status'] ?? 'accepte',
    ]);

    $user->roles()->sync([$data['role_id'] ?? 3]);

    return response()->json(['user' => $user->load('roles')], 201);
}

public function update(Request $request, User $user)
{
    $data = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
        'password' => ['nullable', 'string', 'min:6'],
        'phone' => ['nullable', 'string', 'max:50'],
        'address' => ['nullable', 'string', 'max:255'],
        'bio' => ['nullable', 'string'],
        'status' => ['nullable', 'string'],
        'role_id' => ['nullable', 'integer', 'exists:roles,id'],
    ]);

    $user->fill(Arr::except($data, ['password', 'role_id']));

    if (!empty($data['password'])) {
        $user->password = Hash::make($data['password']);
    }

    $user->save();

    if (!empty($data['role_id'])) {
        $user->roles()->sync([$data['role_id']]);
    }

    return response()->json(['user' => $user->load('roles')]);
}

public function destroy(User $user)
{
    $user->roles()->detach();
    $user->delete();

    return response()->json(['message' => 'Utilisateur supprimé']);
}
```

Imports utiles :

```php
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
```
