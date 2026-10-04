"""Small dispatch gate: budget before submission, stop on consecutive failures."""
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED


def dispatch(jobs, execute, *, budget, workers=3, failure_limit=3):
    jobs = list(jobs)
    if not isinstance(budget, int) or budget < 0 or len(jobs) > budget:
        raise ValueError('Jobs exceed the authorized attempt budget')
    if workers < 1 or failure_limit < 1:
        raise ValueError('Positive workers and failure limit required')
    next_index, consecutive, stopped = 0, 0, False
    results, decisions = {}, []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        active = {}

        def fill():
            nonlocal next_index
            while not stopped and len(active) < workers and next_index < len(jobs):
                index = next_index
                next_index += 1  # Reserve the attempt before submitting, including failures.
                active[pool.submit(execute, jobs[index])] = index

        fill()
        while active:
            done, _ = wait(active, return_when=FIRST_COMPLETED)
            # Stable order for simultaneous completions; pending tasks are never all queued.
            for future in sorted(done, key=lambda f: active[f]):
                index = active.pop(future)
                try:
                    result = future.result()
                except Exception as error:
                    result = {'status': 'unknown', 'error_type': type(error).__name__}
                results[index] = result
                consecutive = 0 if result.get('status') == 'completed' else consecutive + 1
                stopped = stopped or consecutive >= failure_limit
                decisions.append({'index': index, 'status': result.get('status'),
                                  'consecutive_failures': consecutive, 'dispatch_stopped': stopped})
            fill()
    return {'attempts': next_index, 'stopped': stopped,
            'results': [{'index': i, 'result': results[i]} for i in sorted(results)],
            'unstarted_indices': list(range(next_index, len(jobs))), 'decisions': decisions}
