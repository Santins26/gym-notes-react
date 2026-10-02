import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

const days = [
  { value: "segunda", label: "Segunda" },
  { value: "terca", label: "Terça" },
  { value: "quarta", label: "Quarta" },
  { value: "quinta", label: "Quinta" },
  { value: "sexta", label: "Sexta" },
  { value: "sabado", label: "Sábado" },
  { value: "domingo", label: "Domingo" },
];

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [day, setDay] = useState("segunda");
  const [exercises, setExercises] = useState([]);

  const [exerciseName, setExerciseName] = useState("");
  const [sets, setSets] = useState({});
  const [history, setHistory] = useState({});
  const handlekeydown = (e) => {
    if (e.key === "Enter") {
      login();
    }
 };

 const handlekeydownb = (e) => {
    if (e.key === "Enter") {
      addExercise();
    }
 };
  // --------------------------------
  // AUTHENTICATION
  // --------------------------------

  useEffect(() => {
    async function getSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setLoading(false);
    }

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --------------------------------
  // LOAD EXERCISES
  // --------------------------------

  useEffect(() => {
    if (!session) {
      setExercises([]);
      return;
    }

    loadExercises();
  }, [session, day]);

  useEffect(() => {
  if (exercises.length === 0) {
    return;
  }

  async function loadAllHistory() {
    for (const exercise of exercises) {
      await loadHistory(exercise.id);
    }
  }

  loadAllHistory();
}, [exercises]);

  async function loadExercises() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("day", day)
      .eq("user_id", user.id)
      .eq("active", true)
      .order("id");

    if (error) {
      console.error(
        "Erro ao carregar exercícios:",
        error
      );
      return;
    }

    setExercises(data);
  }


  async function addExercise() {

    const name = exerciseName.trim();

    if (!name) {
      alert("Digite o nome do exercício.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("exercises")
      .insert({
        name: name,
        day: day,
        user_id: user.id,
        active: true,
      });

    if (error) {
      console.error(
        "Erro ao adicionar exercício:",
        error
      );

      alert(error.message);
      return;
    }

    setExerciseName("");

    await loadExercises();
  }
  async function loadHistory(exerciseId) {
  // Busca o último treino desse exercício
  const { data: workouts, error: workoutError } =
    await supabase
      .from("workouts")
      .select("id")
      .eq("exercise_id", exerciseId)
      .order("id", { ascending: false })
      .limit(1);

  if (workoutError) {
    console.error(
      "Erro ao carregar histórico:",
      workoutError
    );
    return;
  }

  if (!workouts || workouts.length === 0) {
    setHistory((current) => ({
      ...current,
      [exerciseId]: [],
    }));

    return;
  }

  const workoutId = workouts[0].id;

  // Busca as séries desse último treino
  const { data: workoutSets, error: setsError } =
    await supabase
      .from("workout_sets")
      .select("set_number, weight, reps, created_at")
      .eq("workout_id", workoutId)
      .order("set_number");

  if (setsError) {
    console.error(
      "Erro ao carregar séries:",
      setsError
    );
    return;
  }

  setHistory((current) => ({
    ...current,
    [exerciseId]: workoutSets,
  }));
}

  function updateSet(exerciseId, setNumber, field, value) {
  setSets((current) => ({
    ...current,
    [exerciseId]: {
      ...current[exerciseId],
      [setNumber]: {
        ...current[exerciseId]?.[setNumber],
        [field]: value,
      },
    },
  }));
}

async function saveWorkout(exerciseId) {
  const exerciseSets = sets[exerciseId];

  if (!exerciseSets) {
    alert("Preencha pelo menos uma série.");
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Cria o treino
  const { data: workout, error: workoutError } =
    await supabase
      .from("workouts")
      .insert({
        exercise_id: exerciseId,
      })
      .select()
      .single();

  if (workoutError) {
    console.error(
      "Erro ao criar treino:",
      workoutError
    );

    alert(workoutError.message);
    return;
  }

  // Prepara as séries preenchidas
  const workoutSets = Object.entries(exerciseSets)
    .filter(
      ([, set]) =>
        set.weight !== undefined &&
        set.weight !== "" &&
        set.reps !== undefined &&
        set.reps !== ""
    )
    .map(([setNumber, set]) => ({
      workout_id: workout.id,
      set_number: Number(setNumber),
      weight: Number(set.weight),
      reps: Number(set.reps),
    }));

  if (workoutSets.length === 0) {
    alert("Preencha pelo menos uma série.");
    return;
  }

  // Salva as séries
  const { error: setsError } =
    await supabase
      .from("workout_sets")
      .insert(workoutSets);

  if (setsError) {
    console.error(
      "Erro ao salvar séries:",
      setsError
    );

    alert(setsError.message);
    return;
  }

  alert("Treino salvo!");
  await loadHistory(exerciseId);

  console.log(
    "Treino salvo:",
    workout
  );

  console.log(
    "Séries salvas:",
    workoutSets
  );
}

  // --------------------------------
  // LOGIN
  // --------------------------------

  async function login() {
    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      alert(error.message);
    }
  }

async function removeExercise(id) {
  const { error } = await supabase
    .from("exercises")
    .update({
      active: false,
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao remover exercício:", error);
    alert(error.message);
    return;
  }

  await loadExercises();
}

  async function signup() {
    const { error } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      "Conta criada! Verifique seu email se necessário."
    );
  }

  // --------------------------------
  // LOGOUT
  // --------------------------------

  async function logout() {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Erro ao sair:",
        error
      );
    }
  }

  // --------------------------------
  // LOADING
  // --------------------------------

  if (loading) {
    return <p>Carregando...</p>;
  }

  // --------------------------------
  // LOGIN SCREEN
  // --------------------------------

  if (!session) {
    return (
      <main className="app">

        <header className="app-header">
          <h1>Gym Notes</h1>
          <p>Entre na sua conta</p>
        </header>

        <section>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)}
              onKeyDown={handlekeydown}
            
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)}
              onKeyDown={handlekeydown}
            
          />

          <button onClick={login}>
            Entrar
          </button>

          <button onClick={signup}>
            Criar conta
          </button>

        </section>

      </main>
    );
  }

  // --------------------------------
  // GYM NOTES
  // --------------------------------

  return (
    <main className="app">

      <header className="app-header">

        <h1>Gym Notes</h1>

        <p>
          Logado como: {session.user.email}
        </p>

        <button onClick={logout}>
          Sair
        </button>

      </header>


      {/* DAY SELECT */}

      <section className="day-section">

        <label htmlFor="day">
          Dia do treino
        </label>

        <select
          id="day"
          value={day}
          onChange={(event) =>
            setDay(event.target.value)
          }
        >

          {days.map((item) => (
            <option
              key={item.value}
              value={item.value}
            >
              {item.label}
            </option>
          ))}

        </select>

      </section>


      {/* ADD EXERCISE */}

      <section className="add-section">

        <label htmlFor="exerciseName">
          Novo exercício
        </label>

        <div className="add-form">

          <input
            id="exerciseName"
            type="text"
            placeholder="Nome do exercício"
            value={exerciseName}
            onChange={(event) =>
              setExerciseName(event.target.value)
            }
            onKeyDown={handlekeydownb}
          />

          <button onClick={addExercise}>
            Adicionar
          </button>

        </div>

      </section>


      <section className="exercise-list">

        <h2>
          {
            days.find(
              (item) => item.value === day
            )?.label
          }
        </h2>

        {exercises.length === 0 ? (

          <p className="empty-message">
            Nenhum exercício cadastrado.
          </p>

        ) : (

          exercises.map((exercise) => (
  <article className="exercise-card" key={exercise.id}>
  <div className="exercise-heading">
    <h3>{exercise.name}</h3>

    <button
      className="remove-button"
      onClick={() => removeExercise(exercise.id)}
    >
      Remover
    </button>
  </div>

  <div className="set-row">
    <h4>1ª SÉRIE</h4>

    <label>
      Peso
      <input
  type="number"
  placeholder="Peso"
  value={sets[exercise.id]?.[1]?.weight || ""}
  onChange={(event) =>
    updateSet(
      exercise.id,
      1,
      "weight",
      event.target.value
    )
  }
/>
    </label>

    <label>
      Repetições
      <input
  type="number"
  placeholder="Reps"
  value={sets[exercise.id]?.[1]?.reps || ""}
  onChange={(event) =>
    updateSet(
      exercise.id,
      1,
      "reps",
      event.target.value
    )
  }
/>
    </label>
  </div>

  <div className="set-row">
    <h4>2ª SÉRIE</h4>

    <label>
      Peso
      <input
  type="number"
  placeholder="Peso"
  value={sets[exercise.id]?.[2]?.weight || ""}
  onChange={(event) =>
    updateSet(
      exercise.id,
      2,
      "weight",
      event.target.value
    )
  }
/>
    </label>

    <label>
      Repetições
      <input
  type="number"
  placeholder="Reps"
  value={sets[exercise.id]?.[2]?.reps || ""}
  onChange={(event) =>
    updateSet(
      exercise.id,
      2,
      "reps",
      event.target.value
    )
  }
/>
    </label>
  </div>

  <div className="set-row">
    <h4>3ª SÉRIE</h4>

    <label>
      Peso
      <input
  type="number"
  placeholder="Peso"
  value={sets[exercise.id]?.[3]?.weight || ""}
  onChange={(event) =>
    updateSet(
      exercise.id,
      3,
      "weight",
      event.target.value
    )
  }
/>
    </label>

    <label>
      Repetições
      <input
  type="number"
  placeholder="Reps"
  value={sets[exercise.id]?.[3]?.reps || ""}
  onChange={(event) =>
    updateSet(
      exercise.id,
      3,
      "reps",
      event.target.value
    )
  }
/>
    </label>
  </div>
  

  <button className="save-button"
  onClick={() => saveWorkout(exercise.id)}>
    Salvar treino
  </button>
  <div className="history">
  <h4>Histórico</h4>

  {history[exercise.id]?.length === 0 ? (
    <p>Nenhum treino registrado.</p>
  ) : (
    history[exercise.id]?.map((set) => (
      <p key={set.set_number}>
        {set.set_number}ª série:{" "}
        {set.weight} kg × {set.reps} reps
      </p>
    ))
  )}
</div>
</article>
))

        )}

      </section>

    </main>
  );
}

export default App;