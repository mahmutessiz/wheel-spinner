document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.getElementById('login-container');
    const userContainer = document.getElementById('user-container');
    const loginNav = document.getElementById('login-nav');
    const userNav = document.getElementById('user-nav');
    const loginButtons = document.querySelectorAll('.tg-login');
    const logoutButton = document.getElementById('logout-button');
    const userFirstname = document.getElementById('user-firstname');
    const userUsername = document.getElementById('user-username');
    const totalPoints = document.getElementById('total-points');
    const spinButton = document.getElementById('spin-button');
    const withdrawButton = document.getElementById('withdraw-button');
    const spinResult = document.getElementById('spin-result');
    const wheel = document.querySelector('.wheel');
    const withdrawRequestsBody = document.getElementById('withdraw-requests-body');

    let pollingInterval = null;
    let currentRotation = 0;

    // Function to check auth status and update UI
    const checkAuth = () => {
        fetch('/check-auth')
            .then(response => response.json())
            .then(data => {
                if (data.loggedIn) {
                    userFirstname.textContent = data.user.first_name;
                    // userUsername.textContent = data.user.username;
                    totalPoints.textContent = data.user.total_points || 0;
                    document.getElementById('total-points-value').textContent = data.user.total_points || 0;
                    loginContainer.classList.add('d-none');
                    userContainer.classList.remove('d-none');
                    loginNav.classList.add('d-none');
                    userNav.classList.remove('d-none');

                    fetchWithdrawHistory();
                } else {
                    loginContainer.classList.remove('d-none');
                    userContainer.classList.add('d-none');
                    loginNav.classList.remove('d-none');
                    userNav.classList.add('d-none');
                }
            });
    };

    // Start the login process
    loginButtons.forEach(button => {
        button.addEventListener('click', () => {
            const telegramTab = window.open('', '_blank');
            if (!telegramTab || telegramTab.closed || typeof telegramTab.closed === 'undefined') {
                alert('Please allow popups for this site to log in with Telegram.');
                return;
            }
            telegramTab.document.write('Connecting to Telegram...');

            fetch('/tg-login-start', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    const token = data.token;
                    const botUsername = 'cogeGifts_bot';
                    const telegramUrl = `https://t.me/${botUsername}?start=${token}`;
                    if (telegramTab) {
                        telegramTab.location.href = telegramUrl;
                    }
                    startPolling(token);
                })
                .catch(err => {
                    console.error('Login start error:', err);
                    if (telegramTab) {
                        telegramTab.close();
                    }
                    alert('Could not initiate Telegram login. Please try again.');
                });
        });
    });

    // Poll the server to see if authentication is complete
    const startPolling = (token) => {
        // Clear any existing intervals
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }

        pollingInterval = setInterval(() => {
            fetch('/tg-login-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    clearInterval(pollingInterval);
                    location.reload(); // Reload the page to reflect the logged-in state
                }
            });
        }, 2000); // Poll every 2 seconds

        // Stop polling after 2 minutes
        setTimeout(() => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                console.log('Login timed out.');
            }
        }, 120000);
    };

    // Handle logout
    logoutButton.addEventListener('click', () => {
        fetch('/logout', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                }
            });
    });

    // Initial check when the page loads
    checkAuth();

    // Handle spinning the wheel
    spinButton.addEventListener('click', () => {
        spinButton.disabled = true;
        spinResult.textContent = 'Spinning...';
        spinResult.classList.remove('text-success', 'text-danger');


        fetch('/spin', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const { result, points, winningIndex } = data;
                    
                    // Calculate the rotation to land on the winning slice
                    const sliceAngle = 360 / 8;
                    const targetRotation = 360 - (winningIndex * sliceAngle);

                    const randomRotations = Math.floor(Math.random() * 5) + 5;
                    const totalRotation = (360 * randomRotations) + targetRotation;

                    currentRotation = totalRotation;
                    wheel.style.transform = `rotate(${currentRotation}deg)`;

                    // Wait for the animation to finish
                    setTimeout(() => {
                        if (result === 'JACKPOT') {
                            spinResult.textContent = `JACKPOT! You won ${points} points!`;
                        } else {
                            spinResult.textContent = `Congratulations! You won ${points} points.`;
                        }
                        spinResult.classList.add('text-success');
                        // Update total points on the navbar
                        checkAuth();
                    }, 5000); // Corresponds to the CSS transition duration
                } else {
                    spinResult.textContent = data.message;
                    spinResult.classList.add('text-danger');
                    // Re-enable the button if the error was not about having already spun
                    if (!data.message.includes('already spun')) {
                        spinButton.disabled = false;
                    }
                }
            })
            .catch(error => {
                console.error('Error spinning the wheel:', error);
                spinResult.textContent = 'An error occurred. Please try again.';
                spinResult.classList.add('text-danger');
                spinButton.disabled = false;
            });
    });

    const fetchWithdrawHistory = () => {
        fetch('/withdraw-history')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    withdrawRequestsBody.innerHTML = '';
                    if (data.history.length === 0) {
                        const row = document.createElement('tr');
                        row.innerHTML = `<td colspan="4" class="text-center">No withdrawal history yet.</td>`;
                        withdrawRequestsBody.appendChild(row);
                    } else {
                        data.history.forEach(request => {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${new Date(request.request_date).toLocaleString()}</td>
                                <td>${request.points}</td>
                                <td>${request.solana_address}</td>
                                <td>${request.status}</td>
                            `;
                            withdrawRequestsBody.appendChild(row);
                        });
                    }
                }
            });
    };

    const withdrawModalElement = document.getElementById('withdraw-modal');
    const withdrawModal = new bootstrap.Modal(withdrawModalElement);

    withdrawModalElement.addEventListener('hidden.bs.modal', () => {
        withdrawButton.focus();
    });
    const withdrawForm = document.getElementById('withdraw-form');
    const solanaWalletInput = document.getElementById('solana-wallet');
    const pointsAmountInput = document.getElementById('points-amount');

    withdrawButton.addEventListener('click', () => {
        withdrawModal.show();
    });

    withdrawForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const solanaAddress = solanaWalletInput.value.trim();
        const points = parseInt(pointsAmountInput.value, 10);
        const currentUserPoints = parseInt(totalPoints.textContent, 10);

        if (!solanaAddress) {
            alert('Please enter a valid Solana address.');
            return;
        }
        if (!points || points < 20000) {
            alert('The minimum withdrawal amount is 20,000 points.');
            return;
        }
        if (points > currentUserPoints) {
            alert(`Your withdrawal request of ${points} points exceeds your current balance of ${currentUserPoints} points.`);
            return;
        }

        const submitButton = withdrawForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        fetch('/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solanaAddress, points })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Withdrawal request submitted successfully!');
                withdrawModal.hide();
                checkAuth();
            } else {
                alert(`Error: ${data.message}`);
            }
        })
        .finally(() => {
            submitButton.disabled = false;
        });
    });
});
